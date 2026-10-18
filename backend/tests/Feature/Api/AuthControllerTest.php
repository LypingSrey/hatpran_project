<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class AuthControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    /** Read config/sanctum.php's token lifetime with SANCTUM_EXPIRATION set to the given value, or unset. */
    private function expirationFor(?string $value): ?int
    {
        // env() reads $_SERVER, $_ENV and getenv(), and .env or the shell may have filled any of them.
        $key = 'SANCTUM_EXPIRATION';
        $previous = [$_SERVER[$key] ?? null, $_ENV[$key] ?? null, getenv($key)];
        unset($_SERVER[$key], $_ENV[$key]);
        putenv($key);
        if ($value !== null) {
            $_SERVER[$key] = $value;
        }

        try {
            return (require config_path('sanctum.php'))['expiration'];
        } finally {
            unset($_SERVER[$key], $_ENV[$key]);
            [$server, $env, $getenv] = $previous;
            if ($server !== null) {
                $_SERVER[$key] = $server;
            }
            if ($env !== null) {
                $_ENV[$key] = $env;
            }
            if ($getenv !== false) {
                putenv("{$key}={$getenv}");
            }
        }
    }

    public function test_tokens_expire_after_90_days_unless_set_and_0_means_never(): void
    {
        $this->assertSame(129600, $this->expirationFor(null));
        // An empty line, as the old .env.example shipped, still means the default rather than never.
        $this->assertSame(129600, $this->expirationFor(''));
        $this->assertSame(60, $this->expirationFor('60'));
        $this->assertNull($this->expirationFor('0'));
    }

    public function test_register_creates_user_and_returns_201_with_token(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Jane Lifter',
            'email' => 'jane@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.email', 'jane@example.com')
            ->assertJsonMissingPath('user.password')
            ->assertJsonStructure(['user' => ['id', 'name', 'email'], 'token']);

        $this->assertDatabaseHas('users', ['email' => 'jane@example.com']);
    }

    public function test_register_rejects_empty_payload_with_422(): void
    {
        $this->postJson('/api/register', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email', 'password']);
    }

    public function test_register_rejects_duplicate_email_with_422(): void
    {
        User::factory()->create(['email' => 'taken@example.com']);

        $this->postJson('/api/register', [
            'name' => 'Someone',
            'email' => 'taken@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['email' => 'The email has already been taken.']);
    }

    public function test_register_stores_the_email_in_lowercase(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Sam',
            'email' => ' Sam@Example.com ',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated()
            ->assertJsonPath('user.email', 'sam@example.com');

        $this->assertDatabaseHas('users', ['email' => 'sam@example.com']);
    }

    public function test_register_rejects_an_email_taken_in_different_case_with_422(): void
    {
        User::factory()->create(['email' => 'taken@example.com']);

        $this->postJson('/api/register', [
            'name' => 'Someone',
            'email' => 'Taken@Example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['email' => 'The email has already been taken.']);

        $this->assertDatabaseCount('users', 1);
    }

    public function test_register_is_limited_to_six_attempts_a_minute_with_429(): void
    {
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/register', [])->assertUnprocessable();
        }

        $this->postJson('/api/register', [])->assertTooManyRequests();
    }

    public function test_register_rejects_unconfirmed_password_with_422(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Someone',
            'email' => 'someone@example.com',
            'password' => 'password123',
            'password_confirmation' => 'different123',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);
    }

    public function test_login_returns_token_for_valid_credentials(): void
    {
        $user = User::factory()->create();

        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonStructure(['token']);
    }

    public function test_login_accepts_the_email_in_any_case(): void
    {
        User::factory()->create(['email' => 'sam@example.com']);

        $this->postJson('/api/login', ['email' => ' Sam@Example.COM ', 'password' => 'password'])
            ->assertOk()
            ->assertJsonStructure(['user', 'token']);
    }

    public function test_login_is_limited_to_six_attempts_a_minute_with_429(): void
    {
        $user = User::factory()->create();

        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/login', ['email' => $user->email, 'password' => 'wrong-password'])
                ->assertUnprocessable();
        }

        // Even the right password is refused until the minute is up.
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])
            ->assertTooManyRequests();
    }

    public function test_login_rejects_wrong_password_with_422(): void
    {
        $user = User::factory()->create();

        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'wrong-password'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email' => 'The provided credentials are incorrect.']);
    }

    public function test_login_rejects_unknown_email_with_422(): void
    {
        $this->postJson('/api/login', ['email' => 'nobody@example.com', 'password' => 'password'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_user_returns_the_authenticated_user(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('id', $user->id)
            ->assertJsonMissingPath('password');
    }

    public function test_returns_401_when_no_token_is_provided(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_returns_401_json_when_client_does_not_ask_for_json(): void
    {
        $this->get('/api/user')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Unauthenticated.');
    }

    public function test_returns_401_for_an_invalid_token(): void
    {
        $this->withToken('1|not-a-real-token')->getJson('/api/user')->assertUnauthorized();
    }

    public function test_logout_revokes_only_the_current_token(): void
    {
        $user = User::factory()->create();
        $current = $user->createToken('phone')->plainTextToken;
        $user->createToken('laptop');

        $this->withToken($current)->postJson('/api/logout')->assertOk();

        $this->assertSame(['laptop'], PersonalAccessToken::pluck('name')->all());

        $this->app['auth']->forgetGuards();
        $this->withToken($current)->getJson('/api/user')->assertUnauthorized();
    }
}

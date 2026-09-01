<?php

namespace Modules\Clinic\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Clinic\Http\Requests\LoginRequest;
use Modules\Clinic\Http\Requests\RegisterClinicAdminRequest;
use Modules\Clinic\Http\Requests\RequestPhoneLoginRequest;
use Modules\Clinic\Http\Requests\VerifyPhoneLoginRequest;
use Modules\Clinic\Models\Clinic;
use Throwable;

class AuthController extends Controller
{
    public function register(RegisterClinicAdminRequest $request): JsonResponse
    {
        $validated = $request->validated();

        [$user, $clinic] = DB::transaction(function () use ($validated): array {
            $clinicData = $validated['clinic'];
            $clinic = Clinic::query()->create([
                'name' => $clinicData['name'],
                'slug' => $clinicData['slug'] ?? $this->availableClinicSlug($clinicData['name']),
                'public_domain' => $clinicData['public_domain'] ?? null,
                'settings' => $clinicData['settings'] ?? [],
                'branding' => $clinicData['branding'] ?? [],
            ]);
            $user = User::query()->create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'phone' => $validated['phone'] ?? null,
                'password' => $validated['password'],
            ]);
            $user->clinics()->attach($clinic, ['role' => 'owner']);

            return [$user, $clinic];
        });

        return $this->tokenResponse($user, $clinic, $request->string('device_name', 'clinic-admin-registration')->toString(), 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $user = User::query()->where('email', $validated['email'])->first();

        if ($user === null || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => ['The provided credentials are incorrect.']]);
        }

        $clinic = $this->administratorClinic($user);
        if ($clinic === null) {
            throw ValidationException::withMessages(['email' => ['This account does not have clinic administrator access.']]);
        }

        return $this->tokenResponse($user, $clinic, $validated['device_name'] ?? 'clinic-admin-login');
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(status: 204);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $clinic = $this->administratorClinic($user);

        abort_unless($clinic !== null, 403, 'This account does not have clinic administrator access.');

        return response()->json(['user' => $this->userData($user), 'clinic' => $this->clinicData($clinic)]);
    }

    public function redirectToGoogle(Request $request): RedirectResponse
    {
        $google = config('services.google');
        abort_unless(
            filled($google['client_id'] ?? null) && filled($google['client_secret'] ?? null) && filled($google['redirect'] ?? null),
            503,
            'Google authentication has not been configured.',
        );

        $state = Str::random(64);
        Cache::put('clinic-google-oauth:'.$state, ['requested_at' => now()->toISOString()], now()->addMinutes(10));
        $query = http_build_query([
            'client_id' => $google['client_id'],
            'redirect_uri' => $google['redirect'],
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'access_type' => 'online',
            'prompt' => $request->boolean('prompt') ? 'select_account' : null,
        ]);

        return redirect()->away('https://accounts.google.com/o/oauth2/v2/auth?'.$query);
    }

    public function handleGoogleCallback(Request $request): JsonResponse|RedirectResponse
    {
        $request->validate([
            'code' => ['required', 'string'],
            'state' => ['required', 'string', 'size:64'],
        ]);

        abort_unless(Cache::pull('clinic-google-oauth:'.$request->string('state')->toString()) !== null, 422, 'The Google authentication request has expired.');
        $google = config('services.google');
        abort_unless(
            filled($google['client_id'] ?? null) && filled($google['client_secret'] ?? null) && filled($google['redirect'] ?? null),
            503,
            'Google authentication has not been configured.',
        );

        try {
            $tokens = Http::asForm()
                ->timeout(10)
                ->post('https://oauth2.googleapis.com/token', [
                    'code' => $request->string('code')->toString(),
                    'client_id' => $google['client_id'],
                    'client_secret' => $google['client_secret'],
                    'redirect_uri' => $google['redirect'],
                    'grant_type' => 'authorization_code',
                ])
                ->throw()
                ->json();
            $profile = Http::withToken($tokens['access_token'] ?? '')
                ->timeout(10)
                ->get('https://openidconnect.googleapis.com/v1/userinfo')
                ->throw()
                ->json();
        } catch (Throwable) {
            abort(401, 'Google authentication could not be completed.');
        }

        abort_unless(is_string($profile['email'] ?? null) && ($profile['email_verified'] ?? false) === true, 422, 'Google did not provide a verified email address.');

        $user = User::query()->firstOrCreate(
            ['email' => mb_strtolower($profile['email'])],
            [
                'name' => is_string($profile['name'] ?? null) ? $profile['name'] : Str::before($profile['email'], '@'),
                'email_verified_at' => now(),
                'password' => Str::password(32),
            ],
        );
        $clinic = $this->administratorClinic($user);
        abort_unless($clinic !== null, 403, 'This Google account does not have clinic administrator access.');

        $token = $user->createToken('clinic-admin-google', ['clinic:admin'])->plainTextToken;
        $successRedirect = $google['success_redirect'] ?? null;

        if (filled($successRedirect)) {
            return redirect()->away($successRedirect.(str_contains($successRedirect, '?') ? '&' : '?').http_build_query(['token' => $token]));
        }

        return response()->json(['token' => $token, 'user' => $this->userData($user), 'clinic' => $this->clinicData($clinic)]);
    }

    public function requestPhoneLogin(RequestPhoneLoginRequest $request): JsonResponse
    {
        $phone = $request->validated('phone');
        $user = User::query()->where('phone', $phone)->first();
        if ($user === null || $this->administratorClinic($user) === null) {
            return response()->json(['message' => 'If this number belongs to a clinic administrator, a verification code will be sent shortly.'], 202);
        }

        $code = app()->environment(['local', 'testing'])
            ? (string) (config('services.sms.local_code') ?: random_int(100000, 999999))
            : (string) random_int(100000, 999999);

        if (app()->environment(['local', 'testing'])) {
            Cache::put($this->phoneLoginCacheKey($phone), ['user_id' => $user->id, 'code' => Hash::make($code)], now()->addMinutes(10));

            return response()->json([
                'message' => 'A development verification code has been generated.',
                'developmentCode' => $code,
            ], 202);
        }

        $sms = config('services.sms');
        abort_unless(filled($sms['endpoint'] ?? null) && filled($sms['token'] ?? null), 503, 'Phone authentication has not been configured.');

        Http::withToken($sms['token'])
            ->timeout(10)
            ->post($sms['endpoint'], [
                'to' => $phone,
                'from' => $sms['from'] ?? null,
                'message' => "Your CareFlow verification code is {$code}. It expires in 10 minutes.",
            ])
            ->throw();
        Cache::put($this->phoneLoginCacheKey($phone), ['user_id' => $user->id, 'code' => Hash::make($code)], now()->addMinutes(10));

        return response()->json(['message' => 'A verification code has been sent.'], 202);
    }

    public function verifyPhoneLogin(VerifyPhoneLoginRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $challenge = Cache::pull($this->phoneLoginCacheKey($validated['phone']));
        if (! is_array($challenge) || ! isset($challenge['user_id'], $challenge['code']) || ! Hash::check($validated['code'], $challenge['code'])) {
            throw ValidationException::withMessages(['code' => ['The verification code is invalid or has expired.']]);
        }

        $user = User::query()->find($challenge['user_id']);
        $clinic = $user instanceof User ? $this->administratorClinic($user) : null;
        if ($clinic === null) {
            throw ValidationException::withMessages(['phone' => ['This account does not have clinic administrator access.']]);
        }

        return $this->tokenResponse($user, $clinic, $validated['device_name'] ?? 'clinic-admin-phone');
    }

    private function tokenResponse(User $user, Clinic $clinic, string $deviceName, int $status = 200): JsonResponse
    {
        return response()->json([
            'token' => $user->createToken($deviceName, ['clinic:admin'])->plainTextToken,
            'user' => $this->userData($user),
            'clinic' => $this->clinicData($clinic),
        ], $status);
    }

    private function administratorClinic(User $user): ?Clinic
    {
        return $user->clinics()->wherePivotIn('role', ['owner', 'admin'])->orderBy('clinics.name')->first();
    }

    /** @return array<string, mixed> */
    private function userData(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'phone' => $user->phone];
    }

    /** @return array<string, mixed> */
    private function clinicData(Clinic $clinic): array
    {
        return [
            'id' => $clinic->id,
            'name' => $clinic->name,
            'slug' => $clinic->slug,
            'publicDomain' => $clinic->public_domain,
            'branding' => $clinic->branding,
            'regional' => $clinic->regionalSettings(),
        ];
    }

    private function phoneLoginCacheKey(string $phone): string
    {
        return 'clinic-phone-login:'.hash('sha256', $phone);
    }

    private function availableClinicSlug(string $name): string
    {
        $base = Str::slug($name);
        $slug = $base === '' ? 'clinic' : $base;
        $suffix = 1;

        while (Clinic::query()->where('slug', $slug)->exists()) {
            $suffix++;
            $slug = $base.'-'.$suffix;
        }

        return $slug;
    }
}

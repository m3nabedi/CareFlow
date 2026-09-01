<?php

namespace Modules\Admin\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Modules\Admin\Http\Requests\PlatformAdminLoginRequest;
use Modules\Admin\Http\Requests\StoreClinicRequest;
use Modules\Admin\Http\Requests\UpdateClinicRequest;
use Modules\Clinic\Models\Clinic;
use Modules\Clinic\Models\Questionnaire;
use Modules\Clinic\Models\Submission;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class PlatformAdminController extends Controller
{
    public function login(PlatformAdminLoginRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $user = User::query()->where('email', mb_strtolower($validated['email']))->first();

        if ($user === null || ! Hash::check($validated['password'], $user->password) || ! $user->isPlatformAdministrator()) {
            throw ValidationException::withMessages(['email' => ['The provided credentials are incorrect.']]);
        }

        return response()->json([
            'data' => [
                'token' => $user->createToken($validated['device_name'] ?? 'platform-admin-login', ['platform:admin'])->plainTextToken,
                'user' => $this->userData($user),
            ],
        ]);
    }

    public function dashboard(): JsonResponse
    {
        return response()->json([
            'data' => [
                'clinicsCount' => Clinic::query()->count(),
                'clinicAdministratorsCount' => User::query()
                    ->whereHas('clinics', fn ($query) => $query->whereIn('clinic_user.role', ['owner', 'admin']))
                    ->distinct()
                    ->count('users.id'),
                'questionnairesCount' => Questionnaire::query()->count(),
                'submissionsCount' => Submission::query()->count(),
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(max($request->integer('per_page', 25), 1), 100);
        $clinics = QueryBuilder::for(Clinic::class)
            ->allowedFilters(
                AllowedFilter::partial('name'),
                AllowedFilter::exact('slug'),
                AllowedFilter::exact('public_domain'),
            )
            ->allowedSorts('name', 'slug', 'created_at')
            ->defaultSort('name')
            ->withCount(['questionnaires', 'users'])
            ->paginate($perPage)
            ->appends($request->query());

        return response()->json([
            'data' => $clinics->getCollection()->map(fn (Clinic $clinic): array => $this->clinicData($clinic))->all(),
            'meta' => $this->paginationMeta($clinics),
        ]);
    }

    public function store(StoreClinicRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $clinic = DB::transaction(function () use ($validated): Clinic {
            $clinic = Clinic::query()->create([
                'name' => $validated['name'],
                'slug' => $validated['slug'] ?? $this->availableClinicSlug($validated['name']),
                'public_domain' => $validated['public_domain'] ?? null,
                'settings' => $validated['settings'] ?? [],
                'branding' => $validated['branding'] ?? [],
            ]);

            $this->syncClinicMembers($clinic, $validated['members'] ?? []);

            return $clinic;
        });

        return response()->json([
            'data' => $this->clinicData($clinic->loadCount(['questionnaires', 'users'])->load('users:id,name,email,phone')),
        ], 201);
    }

    public function show(Clinic $clinic): JsonResponse
    {
        return response()->json([
            'data' => $this->clinicData($clinic->loadCount(['questionnaires', 'users'])->load('users:id,name,email,phone'), true),
        ]);
    }

    public function update(UpdateClinicRequest $request, Clinic $clinic): JsonResponse
    {
        $validated = $request->validated();

        DB::transaction(function () use ($clinic, $validated): void {
            $clinic->update(collect($validated)->except('members')->all());

            if (array_key_exists('members', $validated)) {
                $this->syncClinicMembers($clinic, $validated['members']);
            }
        });

        return response()->json([
            'data' => $this->clinicData($clinic->fresh()->loadCount(['questionnaires', 'users'])->load('users:id,name,email,phone')),
        ]);
    }

    /** @param array<int, array{user_id: int, role: string}> $members */
    private function syncClinicMembers(Clinic $clinic, array $members): void
    {
        $membersByUserId = collect($members)
            ->mapWithKeys(fn (array $member): array => [(int) $member['user_id'] => ['role' => $member['role']]])
            ->all();

        $clinic->users()->sync($membersByUserId);
    }

    /** @return array<string, mixed> */
    private function clinicData(Clinic $clinic, bool $includeMembers = false): array
    {
        $data = [
            'id' => $clinic->id,
            'name' => $clinic->name,
            'slug' => $clinic->slug,
            'publicDomain' => $clinic->public_domain,
            'settings' => $clinic->settings,
            'branding' => $clinic->branding,
            'questionnairesCount' => $clinic->questionnaires_count,
            'membersCount' => $clinic->users_count,
            'createdAt' => $clinic->created_at?->toISOString(),
            'updatedAt' => $clinic->updated_at?->toISOString(),
        ];

        if ($includeMembers || $clinic->relationLoaded('users')) {
            $data['members'] = $clinic->users->map(fn (User $user): array => [
                ...$this->userData($user),
                'role' => $user->pivot->role,
            ])->all();
        }

        return $data;
    }

    /** @return array{id: int, name: string, email: string, phone: ?string} */
    private function userData(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
        ];
    }

    /** @return array{currentPage: int, lastPage: int, perPage: int, total: int} */
    private function paginationMeta(LengthAwarePaginator $paginator): array
    {
        return [
            'currentPage' => $paginator->currentPage(),
            'lastPage' => $paginator->lastPage(),
            'perPage' => $paginator->perPage(),
            'total' => $paginator->total(),
        ];
    }

    private function availableClinicSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'clinic';
        $slug = $base;
        $suffix = 2;

        while (Clinic::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }
}

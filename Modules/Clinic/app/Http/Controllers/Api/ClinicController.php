<?php

namespace Modules\Clinic\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Modules\Clinic\Models\Clinic;

class ClinicController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => Clinic::query()->withCount('questionnaires')->orderBy('name')->get()->map(fn (Clinic $clinic): array => $this->data($clinic))->all()]);
    }

    public function show(Clinic $clinic): JsonResponse
    {
        return response()->json(['data' => $this->data($clinic->loadCount('questionnaires'))]);
    }

    /** @return array<string, mixed> */
    private function data(Clinic $clinic): array
    {
        return [
            'id' => $clinic->id,
            'name' => $clinic->name,
            'slug' => $clinic->slug,
            'branding' => $clinic->branding,
            'regional' => $clinic->regionalSettings(),
            'questionnairesCount' => $clinic->questionnaires_count,
        ];
    }
}

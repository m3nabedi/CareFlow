<?php

namespace Modules\Clinic\Providers;

use Modules\Clinic\Console\Commands\ImportWpForms;
use Nwidart\Modules\Support\ModuleServiceProvider;

class ClinicServiceProvider extends ModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Clinic';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'clinic';

    /**
     * Command classes to register.
     *
     * @var string[]
     */
    protected array $commands = [ImportWpForms::class];

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        EventServiceProvider::class,
        RouteServiceProvider::class,
    ];

    /**
     * Define module schedules.
     *
     * @param  $schedule
     */
    // protected function configureSchedules(Schedule $schedule): void
    // {
    //     $schedule->command('inspire')->hourly();
    // }
}

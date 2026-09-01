<?php

namespace App\Console\Commands;

use App\Services\WpFormsImportService;
use Illuminate\Console\Command;
use JsonException;

class ImportWpForms extends Command
{
    protected $signature = 'forms:import-wpforms {file : Absolute path to the WPForms JSON export} {--replace : Replace forms previously imported from the same WPForms form ID}';

    protected $description = 'Import questionnaires from a WPForms JSON export';

    public function handle(WpFormsImportService $importer): int
    {
        $file = $this->argument('file');

        if (! is_file($file) || ! is_readable($file)) {
            $this->components->error("The export file [{$file}] cannot be read.");

            return self::FAILURE;
        }

        try {
            /** @var array<int, array<string, mixed>> $forms */
            $forms = json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
            $result = $importer->import($forms, (bool) $this->option('replace'));
        } catch (JsonException|\InvalidArgumentException $exception) {
            $this->components->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->components->info("Imported {$result['created']} form(s), replaced {$result['replaced']}, skipped {$result['skipped']}.");

        return self::SUCCESS;
    }
}

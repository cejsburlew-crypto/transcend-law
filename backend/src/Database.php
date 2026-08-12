<?php

declare(strict_types=1);

namespace Transcend\Ssp;

use PDO;

class Database
{
    private PDO $pdo;

    public function __construct(string $path)
    {
        $dir = dirname($path);
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        $this->pdo = new PDO('sqlite:' . $path);
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    }

    public function pdo(): PDO
    {
        return $this->pdo;
    }

    public function migrate(): void
    {
        $this->pdo->exec(<<<'SQL'
            CREATE TABLE IF NOT EXISTS site_safety_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transcend_pm_org_id TEXT,
                transcend_pm_project_id TEXT,
                project_name TEXT NOT NULL,
                project_address TEXT,
                general_contractor TEXT,
                site_superintendent TEXT,
                emergency_contact_name TEXT,
                emergency_contact_phone TEXT,
                hospital_name TEXT,
                hospital_phone TEXT,
                fire_department_phone TEXT,
                police_department_phone TEXT,
                hazards_identified TEXT,
                safety_measures TEXT,
                ppe_requirements TEXT,
                training_requirements TEXT,
                incident_reporting TEXT,
                effective_date TEXT,
                prepared_by TEXT,
                status TEXT NOT NULL DEFAULT 'draft',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        SQL);

        $this->addColumnIfMissing('site_safety_plans', 'apn', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'fire_department_name', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'police_department_name', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'urgent_care_name', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'urgent_care_phone', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'property_owner', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'hospital_address', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'urgent_care_address', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'fire_department_address', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'police_department_address', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'fire_department_phone_emergency', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'fire_department_phone_non_emergency', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'police_department_phone_emergency', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'police_department_phone_non_emergency', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'owner_name', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'architect_firm', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'site_safety_director_name', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'site_safety_director_phone', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'site_safety_director_email', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'lfa_contact_name', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'lfa_contact_title', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'lfa_contact_phone', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'lfa_contact_email', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'submission_date', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'site_safety_director_training', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'fire_watch_training', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'fire_access_routes', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'fire_protection_equipment', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'smoking_cooking_policy', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'temporary_heating_plan', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'hot_work_plan', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'combustible_waste_plan', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'flammable_materials_storage', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'site_security_plan', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'plan_changes_procedure', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'lfa_site_specific', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'site_name', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'scope_of_work', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'site_lat', 'REAL');
        $this->addColumnIfMissing('site_safety_plans', 'site_lng', 'REAL');
        $this->addColumnIfMissing('site_safety_plans', 'map_layers', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'plan_drawing', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'contractor_id', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'contractor_contact_name', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'contractor_phone', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'contractor_email', 'TEXT');
        $this->addColumnIfMissing('site_safety_plans', 'map_snapshot', 'TEXT');

        $this->pdo->exec(<<<'SQL'
            CREATE TABLE IF NOT EXISTS ssp_attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ssp_id INTEGER NOT NULL,
                category TEXT NOT NULL DEFAULT 'fire_dept_approved',
                original_name TEXT NOT NULL,
                stored_name TEXT NOT NULL,
                mime_type TEXT,
                size_bytes INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (ssp_id) REFERENCES site_safety_plans(id) ON DELETE CASCADE
            )
        SQL);
    }

    private function addColumnIfMissing(string $table, string $column, string $definition): void
    {
        $stmt = $this->pdo->query("PRAGMA table_info($table)");
        $columns = $stmt->fetchAll();
        foreach ($columns as $col) {
            if (($col['name'] ?? '') === $column) {
                return;
            }
        }

        $this->pdo->exec("ALTER TABLE $table ADD COLUMN $column $definition");
    }
}

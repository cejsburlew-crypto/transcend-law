<?php

declare(strict_types=1);

namespace Transcend\Ssp\Models;

use Transcend\Ssp\Database;

class SiteSafetyPlan
{
    private const FIELDS = [
        'transcend_pm_org_id',
        'transcend_pm_project_id',
        'project_name',
        'project_address',
        'apn',
        'property_owner',
        'owner_name',
        'architect_firm',
        'general_contractor',
        'site_superintendent',
        'site_safety_director_name',
        'site_safety_director_phone',
        'site_safety_director_email',
        'emergency_contact_name',
        'emergency_contact_phone',
        'hospital_name',
        'hospital_address',
        'hospital_phone',
        'urgent_care_name',
        'urgent_care_address',
        'urgent_care_phone',
        'fire_department_name',
        'fire_department_address',
        'fire_department_phone_emergency',
        'fire_department_phone_non_emergency',
        'fire_department_phone',
        'police_department_name',
        'police_department_address',
        'police_department_phone_emergency',
        'police_department_phone_non_emergency',
        'police_department_phone',
        'lfa_contact_name',
        'lfa_contact_title',
        'lfa_contact_phone',
        'lfa_contact_email',
        'submission_date',
        'site_safety_director_training',
        'fire_watch_training',
        'fire_access_routes',
        'fire_protection_equipment',
        'smoking_cooking_policy',
        'temporary_heating_plan',
        'hot_work_plan',
        'combustible_waste_plan',
        'flammable_materials_storage',
        'site_security_plan',
        'plan_changes_procedure',
        'lfa_site_specific',
        'site_name',
        'scope_of_work',
        'site_lat',
        'site_lng',
        'map_layers',
        'plan_drawing',
        'contractor_id',
        'contractor_contact_name',
        'contractor_phone',
        'contractor_email',
        'map_snapshot',
        'hazards_identified',
        'safety_measures',
        'ppe_requirements',
        'training_requirements',
        'incident_reporting',
        'effective_date',
        'prepared_by',
        'status',
    ];

    public function __construct(private Database $db)
    {
    }

    /** @return list<array<string, mixed>> */
    public function all(): array
    {
        $stmt = $this->db->pdo()->query(
            'SELECT * FROM site_safety_plans ORDER BY updated_at DESC'
        );
        return $stmt->fetchAll();
    }

    /** @return array<string, mixed>|null */
    public function find(int $id): ?array
    {
        $stmt = $this->db->pdo()->prepare('SELECT * FROM site_safety_plans WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    /** @param array<string, mixed> $data */
    public function create(array $data): array
    {
        $columns = [];
        $placeholders = [];
        $values = [];

        foreach (self::FIELDS as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }
            $columns[] = $field;
            $placeholders[] = ':' . $field;
            $values[$field] = $data[$field];
        }

        if (!isset($values['status'])) {
            $columns[] = 'status';
            $placeholders[] = ':status';
            $values['status'] = 'draft';
        }

        $sql = sprintf(
            'INSERT INTO site_safety_plans (%s) VALUES (%s)',
            implode(', ', $columns),
            implode(', ', $placeholders)
        );

        $stmt = $this->db->pdo()->prepare($sql);
        $stmt->execute($values);

        return $this->find((int) $this->db->pdo()->lastInsertId()) ?? [];
    }

    /** @param array<string, mixed> $data */
    public function update(int $id, array $data): ?array
    {
        if ($this->find($id) === null) {
            return null;
        }

        $sets = [];
        $values = ['id' => $id];

        foreach (self::FIELDS as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }
            $sets[] = "$field = :$field";
            $values[$field] = $data[$field];
        }

        if ($sets === []) {
            return $this->find($id);
        }

        $sets[] = "updated_at = datetime('now')";
        $sql = 'UPDATE site_safety_plans SET ' . implode(', ', $sets) . ' WHERE id = :id';
        $stmt = $this->db->pdo()->prepare($sql);
        $stmt->execute($values);

        return $this->find($id);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->pdo()->prepare('DELETE FROM site_safety_plans WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->rowCount() > 0;
    }
}

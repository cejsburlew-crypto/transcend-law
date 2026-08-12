<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateProcurementEventsTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'                    => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'agency_id'             => ['type' => 'INT', 'unsigned' => true, 'null' => false],
            'bond_measure_id'       => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'event_type'            => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'service_type'          => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'title'                 => ['type' => 'VARCHAR', 'constraint' => 500, 'null' => true],
            'issue_date'            => ['type' => 'DATE', 'null' => true],
            'due_date'              => ['type' => 'DATE', 'null' => true],
            'award_date'            => ['type' => 'DATE', 'null' => true],
            'awarded_to'            => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'estimated_value'       => ['type' => 'DECIMAL', 'constraint' => '15,2', 'null' => true],
            'status'                => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'description'           => ['type' => 'TEXT', 'null' => true],
            'state'                 => ['type' => 'CHAR', 'constraint' => 2, 'null' => true],
            'portal_name'           => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'source_url'            => ['type' => 'VARCHAR', 'constraint' => 1000, 'null' => true],
            'source_document_title' => ['type' => 'VARCHAR', 'constraint' => 500, 'null' => true],
            'created_at'            => ['type' => 'DATETIME', 'null' => true],
            'updated_at'            => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('agency_id');
        $this->forge->addKey('event_type');
        $this->forge->addKey('due_date');
        $this->forge->createTable('procurement_events');
    }

    public function down(): void
    {
        $this->forge->dropTable('procurement_events');
    }
}

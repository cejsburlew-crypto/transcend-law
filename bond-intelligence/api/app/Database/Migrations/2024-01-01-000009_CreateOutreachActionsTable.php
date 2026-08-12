<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateOutreachActionsTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'          => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'agency_id'   => ['type' => 'INT', 'unsigned' => true, 'null' => false],
            'contact_id'  => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'action_type' => ['type' => 'VARCHAR', 'constraint' => 30, 'null' => true],
            'status'      => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
            'notes'       => ['type' => 'TEXT', 'null' => true],
            'action_date' => ['type' => 'DATETIME', 'null' => true],
            'created_at'  => ['type' => 'DATETIME', 'null' => true],
            'updated_at'  => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('agency_id');
        $this->forge->createTable('outreach_actions');
    }

    public function down(): void
    {
        $this->forge->dropTable('outreach_actions');
    }
}

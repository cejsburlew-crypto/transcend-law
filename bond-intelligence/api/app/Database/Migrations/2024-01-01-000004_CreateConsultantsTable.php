<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateConsultantsTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'              => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'agency_id'       => ['type' => 'INT', 'unsigned' => true, 'null' => false],
            'service_type'    => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'firm_name'       => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'contract_amount' => ['type' => 'DECIMAL', 'constraint' => '15,2', 'null' => true],
            'contract_date'   => ['type' => 'DATE', 'null' => true],
            'source_url'      => ['type' => 'VARCHAR', 'constraint' => 1000, 'null' => true],
            'created_at'      => ['type' => 'DATETIME', 'null' => true],
            'updated_at'      => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('agency_id');
        $this->forge->createTable('consultants');
    }

    public function down(): void
    {
        $this->forge->dropTable('consultants');
    }
}

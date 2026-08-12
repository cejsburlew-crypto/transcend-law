<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateContactsTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'          => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'agency_id'    => ['type' => 'INT', 'unsigned' => true, 'null' => false],
            'role'         => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'name'         => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'title'        => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'email'        => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'phone'        => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'contact_type' => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'linkedin_url' => ['type' => 'VARCHAR', 'constraint' => 500, 'null' => true],
            'verified_at'  => ['type' => 'DATETIME', 'null' => true],
            'source_url'   => ['type' => 'VARCHAR', 'constraint' => 1000, 'null' => true],
            'created_at'  => ['type' => 'DATETIME', 'null' => true],
            'updated_at'  => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('agency_id');
        $this->forge->createTable('contacts');
    }

    public function down(): void
    {
        $this->forge->dropTable('contacts');
    }
}

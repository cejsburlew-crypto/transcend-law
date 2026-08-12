<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateAgenciesTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'              => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'name'            => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => false],
            'normalized_name' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => false],
            'agency_type'     => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'state'           => ['type' => 'CHAR', 'constraint' => 2, 'null' => true],
            'county'          => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
            'city'            => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
            'website'         => ['type' => 'VARCHAR', 'constraint' => 500, 'null' => true],
            'population'      => ['type' => 'INT', 'null' => true],
            'enrollment'      => ['type' => 'INT', 'null' => true],
            'num_schools'     => ['type' => 'INT', 'null' => true],
            'cdiac_id'        => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
            'lat'             => ['type' => 'DECIMAL', 'constraint' => '10,7', 'null' => true],
            'lng'             => ['type' => 'DECIMAL', 'constraint' => '10,7', 'null' => true],
            'created_at'      => ['type' => 'DATETIME', 'null' => true],
            'updated_at'      => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('normalized_name');
        $this->forge->addKey('state');
        $this->forge->addKey('agency_type');
        $this->forge->createTable('agencies');
    }

    public function down(): void
    {
        $this->forge->dropTable('agencies');
    }
}

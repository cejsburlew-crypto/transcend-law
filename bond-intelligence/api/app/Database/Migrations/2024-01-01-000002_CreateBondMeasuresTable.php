<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateBondMeasuresTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'                    => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'agency_id'             => ['type' => 'INT', 'unsigned' => true, 'null' => false],
            'measure_name'          => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'measure_letter'        => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'measure_number'        => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'election_date'         => ['type' => 'DATE', 'null' => true],
            'election_type'         => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'result'                => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
            'vote_pct'              => ['type' => 'DECIMAL', 'constraint' => '5,2', 'null' => true],
            'required_threshold'    => ['type' => 'DECIMAL', 'constraint' => '5,2', 'null' => true],
            'bond_amount'           => ['type' => 'DECIMAL', 'constraint' => '15,2', 'null' => true],
            'bond_purpose'          => ['type' => 'TEXT', 'null' => true],
            'project_categories'    => ['type' => 'TEXT', 'null' => true],
            'authorized_amount'     => ['type' => 'DECIMAL', 'constraint' => '15,2', 'null' => true],
            'issued_amount'         => ['type' => 'DECIMAL', 'constraint' => '15,2', 'null' => true],
            'unissued_amount'       => ['type' => 'DECIMAL', 'constraint' => '15,2', 'null' => true],
            'state'                 => ['type' => 'CHAR', 'constraint' => 2, 'null' => true],
            'opportunity_stage'     => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'source_url'            => ['type' => 'VARCHAR', 'constraint' => 1000, 'null' => true],
            'source_document_title' => ['type' => 'VARCHAR', 'constraint' => 500, 'null' => true],
            'source_date'           => ['type' => 'DATE', 'null' => true],
            'raw_data'              => ['type' => 'TEXT', 'null' => true],
            'created_at'            => ['type' => 'DATETIME', 'null' => true],
            'updated_at'            => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('agency_id');
        $this->forge->addKey('election_date');
        $this->forge->addKey('result');
        $this->forge->createTable('bond_measures');
    }

    public function down(): void
    {
        $this->forge->dropTable('bond_measures');
    }
}

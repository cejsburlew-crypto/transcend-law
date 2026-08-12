<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateScrapeRunsTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'              => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'scraper_name'    => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
            'state'           => ['type' => 'CHAR', 'constraint' => 2, 'null' => true],
            'started_at'      => ['type' => 'DATETIME', 'null' => true],
            'completed_at'    => ['type' => 'DATETIME', 'null' => true],
            'status'          => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'running'],
            'records_found'   => ['type' => 'INT', 'default' => 0],
            'records_added'   => ['type' => 'INT', 'default' => 0],
            'records_created' => ['type' => 'INT', 'default' => 0],
            'records_updated' => ['type' => 'INT', 'default' => 0],
            'errors'          => ['type' => 'TEXT', 'null' => true],
            'notes'           => ['type' => 'TEXT', 'null' => true],
            'log_file'        => ['type' => 'VARCHAR', 'constraint' => 500, 'null' => true],
            'created_at'      => ['type' => 'DATETIME', 'null' => true],
            'updated_at'      => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('scraper_name');
        $this->forge->addKey('started_at');
        $this->forge->createTable('scrape_runs');
    }

    public function down(): void
    {
        $this->forge->dropTable('scrape_runs');
    }
}

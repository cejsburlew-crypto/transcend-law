<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateSourceDocumentsTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'             => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'agency_id'      => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'url'            => ['type' => 'VARCHAR', 'constraint' => 1000, 'null' => true],
            'url_hash'       => ['type' => 'VARCHAR', 'constraint' => 64, 'null' => true],
            'title'          => ['type' => 'VARCHAR', 'constraint' => 500, 'null' => true],
            'doc_type'       => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'document_type'  => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'state'          => ['type' => 'CHAR', 'constraint' => 2, 'null' => true],
            'source_name'    => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'published_date' => ['type' => 'DATE', 'null' => true],
            'scraped_at'     => ['type' => 'DATETIME', 'null' => true],
            'content_hash'   => ['type' => 'VARCHAR', 'constraint' => 64, 'null' => true],
            'raw_text'       => ['type' => 'TEXT', 'null' => true],
            'created_at'     => ['type' => 'DATETIME', 'null' => true],
            'updated_at'     => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('url_hash');
        $this->forge->addKey('agency_id');
        $this->forge->createTable('source_documents');
    }

    public function down(): void
    {
        $this->forge->dropTable('source_documents');
    }
}

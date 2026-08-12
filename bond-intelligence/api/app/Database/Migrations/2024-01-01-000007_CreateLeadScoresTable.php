<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateLeadScoresTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'                       => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'agency_id'                => ['type' => 'INT', 'unsigned' => true, 'null' => false],
            'score'                    => ['type' => 'INT', 'default' => 0],
            'confidence'               => ['type' => 'INT', 'default' => 0],
            'opportunity_stage'        => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'estimated_next_action'    => ['type' => 'TEXT', 'null' => true],
            'recommended_outreach_angle' => ['type' => 'TEXT', 'null' => true],
            'scoring_factors'          => ['type' => 'TEXT', 'null' => true],
            'manual_review_flag'       => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'approach_now'             => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'scored_at'                => ['type' => 'DATETIME', 'null' => true],
            'created_at'               => ['type' => 'DATETIME', 'null' => true],
            'updated_at'               => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('agency_id');
        $this->forge->addKey('score');
        $this->forge->addKey('approach_now');
        $this->forge->createTable('lead_scores');
    }

    public function down(): void
    {
        $this->forge->dropTable('lead_scores');
    }
}

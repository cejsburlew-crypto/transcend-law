<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Builder;

class Agency extends Model
{
    protected $fillable = [
        'name',
        'normalized_name',
        'agency_type',
        'state',
        'county',
        'city',
        'website',
        'population',
    ];

    protected $casts = [
        'population' => 'integer',
    ];

    public function bondMeasures(): HasMany
    {
        return $this->hasMany(BondMeasure::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class);
    }

    public function consultants(): HasMany
    {
        return $this->hasMany(Consultant::class);
    }

    public function procurementEvents(): HasMany
    {
        return $this->hasMany(ProcurementEvent::class);
    }

    public function leadScore(): HasOne
    {
        return $this->hasOne(LeadScore::class);
    }

    public function sourceDocuments(): HasMany
    {
        return $this->hasMany(SourceDocument::class);
    }

    public function outreachActions(): HasMany
    {
        return $this->hasMany(OutreachAction::class);
    }

    public function scopeByState(Builder $query, string $state): Builder
    {
        return $query->where('state', strtoupper($state));
    }

    public function scopeByType(Builder $query, string $type): Builder
    {
        return $query->where('agency_type', $type);
    }

    public function scopeHighScore(Builder $query, int $minScore = 70): Builder
    {
        return $query->whereHas('leadScore', function (Builder $q) use ($minScore) {
            $q->where('score', '>=', $minScore);
        });
    }
}

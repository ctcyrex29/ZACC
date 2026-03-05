<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportStageEvaluation extends Model
{
    use HasFactory;

    protected $fillable = [
        'report_id',
        'investigator_id',
        'stage',
        'investigator_notes',
        'expert_score',
        'manual_score',
        'final_score',
        'expert_context',
    ];

    protected $casts = [
        'expert_context' => 'array',
    ];

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }

    public function investigator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'investigator_id');
    }
}

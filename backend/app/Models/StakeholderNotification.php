<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StakeholderNotification extends Model
{
    use HasFactory;

    protected $fillable = [
        'report_id',
        'user_id',
        'type',
        'title',
        'message',
        'payload',
        'is_read',
        'sent_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'is_read' => 'boolean',
        'sent_at' => 'datetime',
    ];

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

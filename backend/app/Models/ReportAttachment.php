<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportAttachment extends Model
{
    use HasFactory;

    protected $appends = [
        'download_url',
        'is_public',
    ];

    protected $fillable = [
        'report_id',
        'original_name',
        'file_name',
        'mime_type',
        'size',
        'disk',
        'created_by',
    ];

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }

    public function getIsPublicAttribute(): bool
    {
        return $this->disk === 'public';
    }

    public function getDownloadUrlAttribute(): ?string
    {
        if (!$this->report_id) {
            return null;
        }

        return "/api/reports/{$this->report_id}/attachments/{$this->id}/download";
    }
}

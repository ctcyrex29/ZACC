<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_WHISTLEBLOWER = 'WHISTLEBLOWER';
    public const ROLE_INVESTIGATOR = 'INVESTIGATOR';
    public const ROLE_ADMIN = 'ADMIN';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'public_key',
        'private_key_encrypted',
    ];

    protected $appends = ['role_name'];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'private_key_encrypted' => 'encrypted',
    ];

    /**
     * Get the reports for the user.
     */
    public function reports()
    {
        return $this->hasMany(Report::class);
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'private_key_encrypted',
        'public_key',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($user) {
            // Generate a new key pair for the user
            $config = [
                'digest_alg' => 'sha512',
                'private_key_bits' => 4096,
                'private_key_type' => OPENSSL_KEYTYPE_RSA,
            ];

            // Create the private and public key
            $res = openssl_pkey_new($config);

            // Extract the private key
            openssl_pkey_export($res, $privateKey);

            // Extract the public key
            $publicKey = openssl_pkey_get_details($res)['key'];

            // Store the public key and encrypted private key
            $user->public_key = $publicKey;
            $user->private_key_encrypted = Crypt::encryptString($privateKey);
        });
    }

    public function getRoleNameAttribute()
    {
        return [
            self::ROLE_WHISTLEBLOWER => 'Whistleblower',
            self::ROLE_INVESTIGATOR => 'Investigator',
            self::ROLE_ADMIN => 'Administrator',
        ][$this->role] ?? 'Unknown';
    }

    public function getPrivateKeyAttribute()
    {
        return Crypt::decryptString($this->private_key_encrypted);
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isInvestigator(): bool
    {
        return $this->role === self::ROLE_INVESTIGATOR;
    }

    public function isWhistleblower(): bool
    {
        return $this->role === self::ROLE_WHISTLEBLOWER;
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}

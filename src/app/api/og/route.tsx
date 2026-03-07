// ============================================================
// 🏴‍☠️ OG Image Route — 1200×630 social preview card
// ============================================================
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 60%, #0a1628 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative grid lines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(212,175,55,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.06) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Ship emoji — large, decorative */}
        <div
          style={{
            fontSize: '140px',
            lineHeight: 1,
            marginBottom: '24px',
            filter: 'drop-shadow(0 0 30px rgba(212,175,55,0.4))',
          }}
        >
          🏴‍☠️
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '72px',
            fontWeight: 900,
            color: '#D4AF37',
            letterSpacing: '-2px',
            textAlign: 'center',
            lineHeight: 1.1,
            textShadow: '0 0 40px rgba(212,175,55,0.5)',
            marginBottom: '16px',
          }}
        >
          Bots Battle
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '30px',
            fontWeight: 600,
            color: '#e2e8f0',
            textAlign: 'center',
            maxWidth: '900px',
            lineHeight: 1.4,
            marginBottom: '32px',
          }}
        >
          Code Your Fleet. Conquer the Seas.
        </div>

        {/* Language pills */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: '1000px',
          }}
        >
          {['JavaScript', 'TypeScript', 'Python', 'Kotlin', 'Java', 'C#', 'Swift'].map((lang) => (
            <div
              key={lang}
              style={{
                background: 'rgba(212,175,55,0.15)',
                border: '1px solid rgba(212,175,55,0.4)',
                borderRadius: '9999px',
                padding: '6px 20px',
                fontSize: '20px',
                color: '#D4AF37',
                fontWeight: 600,
              }}
            >
              {lang}
            </div>
          ))}
        </div>

        {/* Bottom URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '28px',
            fontSize: '20px',
            color: 'rgba(212,175,55,0.5)',
            letterSpacing: '1px',
          }}
        >
          bots-battle.vercel.app
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui';

interface PasteLLMModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  setCode: (code: string) => void;
  onLoad: () => void;
}

export function PasteLLMModal({ open, onOpenChange, code, setCode, onLoad }: PasteLLMModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[600px] flex flex-col gap-0 p-0 overflow-hidden"
        style={{
          background: '#111827',
          border: '1px solid #d97706',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          maxHeight: '80vh',
        }}
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader
          className="px-5 py-4 shrink-0"
          style={{ background: '#0d1425', borderBottom: '1px solid #1e3a5f' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="font-bold text-base" style={{ color: '#f5a623' }}>
                📥 Paste from LLM
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                Paste improved bot code from ChatGPT, Claude, or any AI assistant.
              </DialogDescription>
            </div>
            <DialogClose
              aria-label="Close paste from LLM dialog"
              className="text-xl leading-none focus:outline-none focus:ring-2 focus:ring-gold/60 rounded"
              style={{ color: '#475569' }}
            >
              <span aria-hidden="true">×</span>
            </DialogClose>
          </div>
        </DialogHeader>

        {/* Textarea */}
        <div className="flex-1 overflow-hidden p-4" style={{ minHeight: 0 }}>
          <textarea
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="Paste bot code from LLM here"
            placeholder={`Paste the createBot() function here…\n\nfunction createBot() {\n  return {\n    tick(state, ship) {\n      // improved logic\n    }\n  };\n}`}
            style={{
              width: '100%',
              height: '280px',
              background: '#050a14',
              border: '1px solid #1e3a5f',
              borderRadius: 6,
              color: '#e2e8f0',
              fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
              fontSize: '0.82rem',
              padding: '0.75rem 1rem',
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
              lineHeight: 1.65,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#d97706';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#1e3a5f';
            }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 pb-4 shrink-0">
          <button
            onClick={onLoad}
            disabled={!code.trim()}
            className="flex-1 py-2.5 rounded font-semibold text-sm transition-colors"
            style={{
              background: code.trim() ? '#d97706' : '#1e3a5f',
              color: code.trim() ? '#0a0e1a' : '#475569',
              cursor: code.trim() ? 'pointer' : 'not-allowed',
              border: 'none',
            }}
          >
            Load into Editor
          </button>
          <DialogClose
            aria-label="Cancel and close"
            className="px-4 py-2.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gold/60"
            style={{ background: '#0a0e1a', color: '#64748b', border: '1px solid #1e3a5f' }}
          >
            Cancel
          </DialogClose>
          {code.trim() && (
            <span className="text-xs shrink-0" style={{ color: '#475569' }}>
              {code.trim().split('\n').length} lines
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

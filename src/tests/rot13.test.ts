import { describe, it, expect } from 'vitest';
import { rot13, isLikelyRot13, maybeDecodeRot13 } from '@/utils/rot13';

describe('rot13 utility', () => {
  describe('rot13()', () => {
    it('encodes and decodes lowercase letters', () => {
      expect(rot13('hello')).toBe('uryyb');
      expect(rot13('uryyb')).toBe('hello');
    });

    it('encodes and decodes uppercase letters', () => {
      expect(rot13('HELLO')).toBe('URYYB');
      expect(rot13('URYYB')).toBe('HELLO');
    });

    it('preserves non-alphabetic characters', () => {
      expect(rot13('hello, world! 123')).toBe('uryyb, jbeyq! 123');
    });

    it('is its own inverse', () => {
      const text = 'Under the rock near the bench.';
      expect(rot13(rot13(text))).toBe(text);
    });

    it('handles empty strings', () => {
      expect(rot13('')).toBe('');
    });
  });

  describe('isLikelyRot13()', () => {
    it('detects classic ROT13-encoded geocache hints', () => {
      // "Under the rock near the bench" -> ROT13
      expect(isLikelyRot13('Haqre gur ebpx arne gur orapu')).toBe(true);
      // "Behind the tree, look up"
      expect(isLikelyRot13('Oruvaq gur gerr, ybbx hc')).toBe(true);
      // "Hidden in a hollow log"
      expect(isLikelyRot13('Uvqqra va n ubyybj ybt')).toBe(true);
    });

    it('does not flag plain English text as ROT13', () => {
      expect(isLikelyRot13('Under the rock near the bench')).toBe(false);
      expect(isLikelyRot13('Behind the tree, look up')).toBe(false);
      expect(isLikelyRot13('Hidden in a hollow log')).toBe(false);
    });

    it('returns false for empty or non-textual input', () => {
      expect(isLikelyRot13('')).toBe(false);
      expect(isLikelyRot13('   ')).toBe(false);
      expect(isLikelyRot13('123 456')).toBe(false);
    });

    it('returns false for very short alphabetic content', () => {
      // Too short to make a confident judgement
      expect(isLikelyRot13('ab')).toBe(false);
    });

    it('handles mixed-case ROT13 hints', () => {
      // "Look Behind The Sign"
      expect(isLikelyRot13('Ybbx Oruvaq Gur Fvta')).toBe(true);
    });
  });

  describe('maybeDecodeRot13()', () => {
    it('decodes ROT13 hints to plain English', () => {
      expect(maybeDecodeRot13('Haqre gur ebpx arne gur orapu')).toBe(
        'Under the rock near the bench',
      );
    });

    it('leaves plain English hints unchanged', () => {
      const hint = 'Under the rock near the bench';
      expect(maybeDecodeRot13(hint)).toBe(hint);
    });

    it('leaves non-textual content unchanged', () => {
      expect(maybeDecodeRot13('')).toBe('');
      expect(maybeDecodeRot13('123 456')).toBe('123 456');
    });
  });
});

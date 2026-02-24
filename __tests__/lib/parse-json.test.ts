import { parseJsonResponse } from '@/lib/ai/parse-json';

describe('parseJsonResponse', () => {
  // 1. Valid JSON with preamble text
  it('extracts JSON from text with a preamble', () => {
    const input = 'Here is the result: {"key": "value"} done';
    expect(parseJsonResponse<{ key: string }>(input)).toEqual({ key: 'value' });
  });

  // 2. Valid JSON with trailing text
  it('extracts JSON ignoring trailing text', () => {
    const input = '{"status": "ok"} --- end of response';
    expect(parseJsonResponse<{ status: string }>(input)).toEqual({ status: 'ok' });
  });

  // 3. Nested objects
  it('parses nested objects correctly', () => {
    const input = '{"a": {"b": {"c": 1}}}';
    expect(parseJsonResponse<{ a: { b: { c: number } } }>(input)).toEqual({
      a: { b: { c: 1 } },
    });
  });

  // 4. Nested arrays in objects
  it('parses objects containing arrays', () => {
    const input = '{"items": [1, 2, 3]}';
    expect(parseJsonResponse<{ items: number[] }>(input)).toEqual({
      items: [1, 2, 3],
    });
  });

  // 5. No opening brace
  it('throws when no opening brace is found', () => {
    expect(() => parseJsonResponse('no json here')).toThrow(
      'No JSON found in AI response'
    );
  });

  // 6. Unbalanced braces (more opens than closes)
  it('throws when braces are unbalanced', () => {
    expect(() => parseJsonResponse('{"a": {"b": 1}')).toThrow(
      'Unbalanced JSON braces in AI response'
    );
  });

  // 7. Control characters cleaned (null bytes removed)
  it('strips null bytes and other control characters', () => {
    const input = '{"msg": "hel\x00lo\x01"}';
    expect(parseJsonResponse<{ msg: string }>(input)).toEqual({
      msg: 'hello',
    });
  });

  // 8. Tabs and newlines converted to spaces
  it('converts tabs and newlines to spaces', () => {
    // Real tab between key and value; real newline between fields
    // \\n inside the value is the JSON escape for newline, not a control char
    const input = '{"greeting":\t"hello\\nworld",\n"count": 1}';
    const result = parseJsonResponse<{ greeting: string; count: number }>(input);
    // Structural tab/newline become spaces before JSON.parse;
    // the \\n inside the string value is interpreted by JSON.parse as a real newline
    expect(result.greeting).toBe('hello\nworld');
    expect(result.count).toBe(1);
  });

  // 9. Empty object
  it('parses an empty object', () => {
    const input = '{}';
    expect(parseJsonResponse<Record<string, never>>(input)).toEqual({});
  });

  // 10. Deeply nested structure (3+ levels)
  it('handles deeply nested structures', () => {
    const input = '{"l1": {"l2": {"l3": {"l4": "deep"}}}}';
    const result = parseJsonResponse<{
      l1: { l2: { l3: { l4: string } } };
    }>(input);
    expect(result.l1.l2.l3.l4).toBe('deep');
  });

  // 11. Multiple top-level objects picks first complete one
  it('extracts only the first complete JSON object', () => {
    const input = '{"first": true} {"second": true}';
    expect(parseJsonResponse<{ first: boolean }>(input)).toEqual({
      first: true,
    });
  });

  // 12. Invalid JSON after extraction (valid braces but not valid JSON)
  it('throws SyntaxError when extracted text is not valid JSON', () => {
    const input = '{not valid json at all}';
    expect(() => parseJsonResponse(input)).toThrow(SyntaxError);
  });
});

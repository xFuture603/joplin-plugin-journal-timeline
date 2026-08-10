import { stripRepeatedTitle } from './render';

describe('stripRepeatedTitle', () => {
	// The panel shows the date as the entry heading, so a note that opens with
	// the same date would print it twice.
	test('drops a leading heading that repeats the entry date', () => {
		expect(stripRepeatedTitle('# 2026-08-10\n\nWoke early.', '2026-08-10')).toBe('Woke early.');
		expect(stripRepeatedTitle('## 2026-08-10\nWoke early.', '2026-08-10')).toBe('Woke early.');
	});

	test('leaves other headings alone', () => {
		const body = '# A different heading\n\nText.';
		expect(stripRepeatedTitle(body, '2026-08-10')).toBe(body);
	});

	test('leaves the date alone when it appears in the prose', () => {
		const body = 'Text about 2026-08-10.';
		expect(stripRepeatedTitle(body, '2026-08-10')).toBe(body);
	});

	test('leaves a heading that only starts with the date', () => {
		const body = '# 2026-08-10 trip notes\n\nText.';
		expect(stripRepeatedTitle(body, '2026-08-10')).toBe(body);
	});

	test('handles an empty body', () => {
		expect(stripRepeatedTitle('', '2026-08-10')).toBe('');
	});
});

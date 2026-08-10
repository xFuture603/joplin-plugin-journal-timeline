/** @type {import('jest').Config} */
const config = {
	preset: 'ts-jest',
	testEnvironment: 'node',

	// The Joplin API is only available inside the app. Types still resolve to the
	// real `api/` directory through tsconfig's baseUrl, so the tests stay type
	// checked against the genuine API while calling a stub at runtime.
	moduleNameMapper: {
		'^api$': '<rootDir>/test/mocks/api.ts',
		'^api/types$': '<rootDir>/test/mocks/apiTypes.ts',
	},
};

module.exports = config;

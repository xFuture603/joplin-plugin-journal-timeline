// Stand-in for the `api` module, which only exists inside Joplin. Anything the
// tests reach for here is a mistake: the pure functions under test must not call
// into the app, so a loud failure is the right behaviour.
const unavailable = (): never => {
	throw new Error('The Joplin API is not available in tests. Test pure functions, or inject a fake.');
};

const joplin = new Proxy({}, {
	get: () => new Proxy(unavailable, { get: () => unavailable }),
});

export default joplin;

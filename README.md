## Basic usage
Simply run **Migrate to React class** command to convert _React stateless components_ to _React class components_.

![Usage](docs/usage.gif)

Additionally, if the file is _TypeScript React_ (`*.tsx`), this also converts `PropTypes` to type definitions accordingly.

Given the snippet below, the extension converts to...
```tsx
// Before
class MyComponent extends React.Component {
	static propTypes = {
		className: PropTypes.string,
		children: PropTypes.node.isRequired,
	}

	render() {
		return <div></div>
	}
}

// After
class MyComponent extends React.Component<{ className?: string; children: React.ReactNode }> {
	render() {
		return <div></div>
	}
}
```


Note that version 2.0.0 does not support migrating `React.createClass`.

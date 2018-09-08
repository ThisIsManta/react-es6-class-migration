## Basic usage
Simply run **Migrate to React class** command to convert _React stateless components_ to _React class components_.

![Usage](docs/usage.gif)

Additionally, if the file is _TypeScript React_ (`*.tsx`), this also converts `PropTypes` to type definitions accordingly.
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
class MyComponent extends React.Component<{
	className?: string
	children: React.ReactNode
}> {
	render() {
		return <div></div>
	}
}
```

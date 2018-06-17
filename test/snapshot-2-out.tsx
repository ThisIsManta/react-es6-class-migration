import React from 'react'

export default class myComponent extends React.Component<{
// You can declare that a prop is a specific JS primitive. By default, these
// are all optional.
optionalArray?: Array<any>
optionalBool?: boolean
optionalFunc?: () => void
optionalNumber?: number
optionalObject?: object
optionalString?: string
optionalSymbol?: symbol

// Anything that can be rendered: numbers, strings, elements or an array
// (or fragment) containing these types.
optionalNode?: React.ReactNode

// A React element.
optionalElement?: JSX.Element

// You can also declare that a prop is an instance of a class. This uses
// JS's instanceof operator.
optionalMessage?: Message

// You can ensure that your prop is limited to specific values by treating
// it as an enum.
optionalEnum?: "News" | "Photos"

// An object that could be one of many types
optionalUnion?: string | number | Message

// An array of a certain type
optionalArrayOf?: Array<number>

// An object with property values of a certain type
optionalObjectOf?: { [string]: number }

// An object taking on a particular shape
optionalObjectWithShape?: { color: string, fontSize: number }

// You can chain any of the above with `isRequired` to make sure a warning
// is shown if the prop isn't provided.
requiredFunc: () => void

// A value of any data type
requiredAny: any
}> {

	static defaultProps = {}
}

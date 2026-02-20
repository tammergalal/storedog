import React from 'react'
import { datadogRum } from '@datadog/browser-rum'

class ErrorBoundary extends React.Component<
  { children?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children?: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true }
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    datadogRum.addError(error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h2 className="mb-2 text-3xl">Oops, there is an error!</h2>
          <button
            type="button"
            className=" bg-neutral-500 px-2 py-1 text-lg text-neutral-100 hover:bg-neutral-600 "
            onClick={() => location.assign('/')}
          >
            Go back home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary

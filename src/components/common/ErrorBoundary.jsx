import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8">
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            문제가 발생했습니다
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {this.state.error?.message || '알 수 없는 오류'}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            다시 시도
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

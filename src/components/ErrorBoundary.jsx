import { Component } from "react";

export default class ErrorBoundary extends Component {
	state = { error: null };

	static getDerivedStateFromError(error) {
		return { error };
	}

	componentDidCatch(error, info) {
		console.error("UI error:", error, info?.componentStack);
	}

	render() {
		if (!this.state.error) return this.props.children;
		return (
			<div className="error-boundary" role="alert">
				<h2>Nekaj je šlo narobe</h2>
				<p>
					Zaslona ni bilo mogoče naložiti. Preverite povezavo in
					poskusite znova.
				</p>
				<button type="button" onClick={() => window.location.reload()}>
					Ponovno naloži
				</button>
			</div>
		);
	}
}

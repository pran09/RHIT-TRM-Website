var trm = trm || {};

trm.ROSEFIRE_SECRET_KEY = 'ec8f39ee-23ee-48f0-b1dc-14c9a58a7fa2';
trm.authManager = null;

trm.MainPageController = class {
	constructor() {
		document.querySelector('#navbarButton').onclick = (event) => {
			trm.authManager.signIn();
			this.updateView();
		};
	}

	updateView() {
		if (trm.authManager.isSignedIn) {
			document.querySelector('#navbarButton').innerText = 'Tasks';
		}
	}

}

trm.AuthManager = class {
	constructor() {
		this._user = null;
	}

	beginListening(changeListener) {
		firebase.auth().onAuthStateChanged((user) => {
			this._user = user;
			changeListener();
		});
	}

	signIn() {
		Rosefire.signIn(trm.ROSEFIRE_SECRET_KEY, (err, rfUser) => {
			if (err) {
				console.log("Rosefire error!", err);
				return;
			}
			console.log("Rosefire success!", rfUser);

			firebase.auth().signInWithCustomToken(rfUser.token).catch(function(error) {
				const errorCode = error.code;
				const errorMessage = error.message;
				if (errorCode == 'auth/invalid-custom-token') {
					alert('The token you provided is invalid');
				} else {
					console.error()
				}
			});
		});
	}

	get isSignedIn() {
		return !!this._user;
	}
}

trm.main = function () {
	console.log("Ready");
	trm.authManager = new trm.AuthManager();
	new trm.MainPageController();
};

trm.main();

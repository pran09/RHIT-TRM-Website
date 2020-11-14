var trm = trm || {};

trm.ROSEFIRE_SECRET_KEY = 'ec8f39ee-23ee-48f0-b1dc-14c9a58a7fa2';
trm.FB_COLLECTION_TASKS = 'Tasks';
trm.FB_KEY_INFO = 'info';
trm.FB_KEY_NAME = 'name';
trm.FB_KEY_MEMBER = 'member';
trm.FB_KEY_DATE_ASSIGNED = 'dateAssigned';
trm.FB_KEY_IS_APPROVED = 'isApproved';
trm.FB_COLLECTION_USERS = 'Users';
trm.FB_KEY_EMAIL = 'email';
trm.FB_KEY_IS_OFFICER = 'isOfficer';
trm.authManager = null;
trm.taskManager = null;
trm.docId = null;

trm.MainPageController = class {
	constructor() {
		document.querySelector('#navbarButton').onclick = (event) => {
			trm.authManager.signIn();
			this.updateView();
		};
	}

	updateView() {
		if (trm.authManager.isSignedIn) {
			const navbarButton = document.querySelector('#navbarButton');
			navbarButton.innerText = 'Tasks';
			navbarButton.onclick = () => {
				window.location.href = "/tasks.html";
			};
		}
	}
}

function htmlToElement(html) {
	var template = document.createElement('template');
	html = html.trim();
	template.innerHTML = html;
	return template.content.firstChild;
}

trm.TaskPageController = class {
	constructor() {
		document.querySelector('#logoutButton').onclick = () => {
			trm.authManager.signOut();
		}

		document.querySelector('#submitAddTask').onclick = () => {
			const name = document.querySelector('#inputName').value;
			const info = document.querySelector('#inputInfo').value;
			const memberString = document.querySelector('#inputMembers').value;
			// let userDoc = null;
			let query = firebase.firestore().collection(trm.FB_COLLECTION_USERS).where("uid", "==", memberString).get()
				.then(querySnapshot => {
					return querySnapshot.docs[0];
					// querySnapshot.forEach(doc => {
					// 	userDoc = doc.id;
					// });
				})
				.then(doc => {
					trm.taskManager.add(name, info, doc);
				})
				.catch(err => console.error(err));
		}

		$('#addTaskDialog').on('show.bs.modal', () => {
			// pre animation
			document.querySelector('#inputName').value = "";
			document.querySelector('#inputInfo').value = "";
			document.querySelector('#inputMembers').value = "";
		});

		$('#addTaskDialog').on('shown.bs.modal', () => {
			// post animation
			document.querySelector('#inputName').focus();
		});
		// Start listening
		trm.taskManager.beginListening(this.updateView.bind(this));
	}

	_createCard(task) {
		return htmlToElement(
			`<div class="card" data-toggle="modal" data-target="#infoModal" data-info="${task.info}">
        			<div class="card-body">
          				<h5 class="card-title">${task.name}</h5>
          				<h6 class="card-subtitle mb-2 text-muted">${task.isApproved}</h6>
        			</div>
      			   </div>`);
	}

	updateView() {
		// Make a new taskContainer
		const newList = htmlToElement('<div id="taskContainer"></div>');
		// Fill the container with quote cards
		for (let i = 0; i < trm.taskManager.length; i++) {
			const task = trm.taskManager.getTaskAtIndex(i);
			const newCard = this._createCard(task);
			$('#infoModal').on('show.bs.modal', function (event) {
				const card = $(event.relatedTarget);
				document.querySelector('.modal-body').innerText = card.data('info');
			})
			newList.appendChild(newCard);
		}
		// Remove the old taskContainer
		const oldList = document.querySelector('#taskContainer');
		oldList.removeAttribute("id");
		oldList.hidden = true;
		// Put in the new taskContainer
		oldList.parentElement.appendChild(newList);

		if(trm.docId.get().then(doc => doc.data().isOfficer)) {
			document.querySelector('#fab').style.display = 'inline-block';
		}
	}
}

trm.Task = class {
	constructor(id, name, info, isApproved) {
		this.id = id;
		this.info = info;
		this.name = name;
		if (!isApproved) {
			this.isApproved = "Not Complete";
		} else {
			this.isApproved = "Complete";
		}
	}
}

trm.TaskManager = class {
	constructor(uid) {
		console.log('Task Manager constructor uid: ', trm.authManager.uid);
		this._uid = uid;
		this._documentSnapshots = [];
		this._ref = firebase.firestore().collection(trm.FB_COLLECTION_TASKS);
		this._unsubscribe = null;
	}

	add(name, info, member) {
		// add new task document with generated ID
		console.log('within add: ', member);
		this._ref.add({
			[trm.FB_KEY_NAME]: name,
			[trm.FB_KEY_INFO]: info,
			[trm.FB_KEY_MEMBER]: member,
			[trm.FB_KEY_IS_APPROVED]: false,
			[trm.FB_KEY_DATE_ASSIGNED]: firebase.firestore.Timestamp.now()
		})
			.then(function (docRef) {
				console.log("Document written with ID: ", docRef);
			})
			.catch(function (error) {
				console.log("Error adding document: ", error);
			});
	}

	beginListening(changeListener) {
		// console.log('user doc id in begin listening: ', trm.authManager.userDocId);
		let query = firebase.firestore().collection(trm.FB_COLLECTION_USERS).where("uid", "==", trm.authManager.uid).get()
			.then((querySnapshot) => {
				const uid = querySnapshot.docs[0].id;
				return uid;
			}).then(uid => {
				trm.docId = firebase.firestore().collection(trm.FB_COLLECTION_USERS).doc(uid);
				let query = this._ref.orderBy(trm.FB_KEY_DATE_ASSIGNED, 'desc').limit(50)
					.where(trm.FB_KEY_MEMBER, "==", trm.docId);
				this._unsubscribe = query.onSnapshot((querySnapshot) => {
					console.log("Task update!");
					this._documentSnapshots = querySnapshot.docs;
					changeListener();
			})
		})
			.catch(err => console.error(err));
	}

	stopListening() {
		this._unsubscribe();
	}

	// update(id, quote, movie) {    }
	// delete(id) { }
	get length() {
		return this._documentSnapshots.length;
	}

	getTaskAtIndex(index) {
		const docSnapshot = this._documentSnapshots[index];
		const task = new trm.Task(
			docSnapshot.id,
			docSnapshot.get(trm.FB_KEY_INFO),
			docSnapshot.get(trm.FB_KEY_NAME),
			docSnapshot.get(trm.FB_KEY_IS_APPROVED)
		);
		return task;
	}
}

trm.AuthManager = class {
	constructor() {
		this._user = null;
		this._documentSnapshots = [];
		this._ref = firebase.firestore().collection(trm.FB_COLLECTION_USERS);
		this._unsubscribe = null;
		this._userDocID = null;
	}

	beginListening(changeListener) {
		firebase.auth().onAuthStateChanged((user) => {
			console.log('auth state change');
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

	signOut() {
		firebase.auth().signOut()
			.then(() => {
				window.location.href = "/";
			})
			.catch(err => console.error(err));
	}

	get uid() {
		return this._user.uid;
	}

	get isSignedIn() {
		return !!this._user;
	}

	get userDocId() {
		return this._userDocID;
	}
}

trm.checkForRedirect = function () {
	if (!document.querySelector('#mainPage') && !trm.authManager.isSignedIn) {
		console.log('redirect back to main');
		window.location.href = "/";
	}
};

trm.initializePage = function () {
	if (document.querySelector('#mainPage')) {
		new trm.MainPageController();
	} else if (document.querySelector('#tasksPage')) {
		trm.taskManager = new trm.TaskManager(trm.authManager.uid);
		new trm.TaskPageController();
	}
};

trm.main = function () {
	console.log("Ready");
	trm.authManager = new trm.AuthManager();
	trm.authManager.beginListening(() => {
		// change listener
		trm.checkForRedirect();
		// initialize page
		trm.initializePage();
	});
};

trm.main();

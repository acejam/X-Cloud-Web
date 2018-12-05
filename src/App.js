import _ from 'lodash';
import $ from 'jquery';
import fileDownload from 'js-file-download';
import React, { Component } from 'react';
import Header from './Header';
import FileCommander from './FileCommander';
import update from 'immutability-helper';
import {isMobile} from 'react-device-detect';
import Popup from "reactjs-popup";
import Loader from './Loader';
import './App.css';
import KeyPage from './KeyPage';

class App extends Component {
  
  
  constructor() {
    super()
    this.state = {
      token: "",
      user: {},
      currentFolderId: null,
      currentFolderBucket: null,
      currentCommanderItems: [],
      namePath: [],
      isAuthorized: false,
      selectedItems: [],
      chooserModalOpen: false,
      mnemonicModal: true
    }
    this.openFolder = this.openFolder.bind(this)
    this.getFolderContent = this.getFolderContent.bind(this)
    this.createFolder = this.createFolder.bind(this)
    this.openUploadFile = this.openUploadFile.bind(this)
    this.openUploadFile = this.openUploadFile.bind(this)
    this.uploadFile = this.uploadFile.bind(this)
    this.downloadFile = this.downloadFile.bind(this)
    this.deleteItems = this.deleteItems.bind(this)
    this.selectCommanderItem = this.selectCommanderItem.bind(this)
    this.closeModal = this.closeModal.bind(this)
    this.closeMnemonicModal = this.closeMnemonicModal.bind(this)
    this.saveMnemonicToDataase = this.saveMnemonicToDataase.bind(this)
    this.setHeaders = this.setHeaders.bind(this)
  }

  componentDidMount() {
    var civicSip = new civic.sip({ appId: 'Skzcny80G' }); // eslint-disable-line no-undef
    if (!sessionStorage.getItem('xToken')) {
      civicSip.signup({ style: 'popup', scopeRequest: civicSip.ScopeRequests.BASIC_SIGNUP }); // eslint-disable-line no-undef
    } else {
      this.getFolderContent(JSON.parse(sessionStorage.getItem('xUser')).root_folder_id)
    }
    civicSip.on('auth-code-received', (event) => {
      var jwtToken = event.response;
      fetch('/api/auth', {
        method: 'get',
        headers: {
            "civicToken": jwtToken,
            'content-type': 'application/json; charset=utf-8',
        },
        
      })
      .then(response => {
        return response.json()
      })
      .then(response => {
        if (isMobile) {
          this.setState({chooserModalOpen: true})
        }
        var token = response.token
        var user = response.user
        var mnemonic = response.user.mnemonic; 
        sessionStorage.setItem('xToken', token)
        sessionStorage.setItem('xUser', JSON.stringify(user))
        this.setState({token, user})
        if (!mnemonic) {
          this.getFolderContent(JSON.parse(sessionStorage.getItem('xUser')).root_folder_id);
          return;
        }
        sessionStorage.setItem('xMnemonic', mnemonic)
        this.setState({ mnemonicModal: true })
      })
    });

    civicSip.on('user-cancelled', function (event) {

    });

    civicSip.on('read', function (event) {

    });

    civicSip.on('civic-sip-error', function (error) {
        console.log('Error type = ' + error.type);
        console.log('Error message = ' + error.message);
    });
  }

  setHeaders() {
    var headers = {
      "Authorization": `Bearer ${sessionStorage.getItem('xToken')}`,
      'content-type': 'application/json; charset=utf-8',
    }
    if (!this.state.user.mnemonic) {
      headers = Object.assign(headers, { 'internxt-mnemonic': sessionStorage.getItem('xMnemonic') });
    }
    return headers
  }

  saveMnemonicToDataase(){
    
    fetch(`/api/auth/mnemonic`, {
      method: 'PUT',
      headers: {
          "Authorization": `Bearer ${sessionStorage.getItem('xToken')}`,
          'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        id: this.state.user.id,
        mnemonic: sessionStorage.getItem('xMnemonic')
      })
    }).then(() => {
      this.setState({ mnemonicModal: false })
      this.getFolderContent(this.state.user.root_folder_id);
    })

  }

  closeMnemonicModal() {
    this.setState({mnemonicModal: false})
    this.getFolderContent(JSON.parse(sessionStorage.getItem('xUser')).root_folder_id)
  }

  getFolderContent(rootId, updateNamePath = true) {
    const headers = this.setHeaders();
    fetch(`/api/storage/folder/${rootId}`, {
      method: 'get',
      headers: headers
    })
    .then(response => response.json())
    .then(data => {
      this.deselectAll()
      this.setState({
        currentCommanderItems: _.concat(_.map(data.children, o => _.extend({type: 'Folder'}, o)), data.files),
        currentFolderId: data.id,
        currentFolderBucket: data.bucket,
        selectedItems: []
      })
      if (updateNamePath) {
        const folderName = data.name.includes('root') ? 'Root' : data.name
        this.setState({
          namePath: this.pushNamePath({name: folderName, id: data.id, bucket: data.bucket}),
          isAuthorized: true
        })
      }
    })
  }

  openFolder(e) {
    this.getFolderContent(e)
  }

  createFolder() {
    var folderName = prompt("Please enter folder name");
    var headers = this.setHeaders();
    if (folderName != null) {
      fetch(`/api/storage/folder`, {
        method: 'post',
        headers: headers,
        body: JSON.stringify({
          "parentFolderId": this.state.currentFolderId,
          "folderName": folderName
        })
      }).then(() => {
        this.getFolderContent(this.state.currentFolderId, false)
      })
    }
  }

  openUploadFile() {
    $('input#uploadFile').trigger('click')
  }

  uploadFile(e) {
    const data = new FormData();
    const headers = this.setHeaders();
    data.append('xfile', e.target.files[0]);
    fetch(`/api/storage/folder/${this.state.currentFolderId}/upload`, {
      method: 'post',
      headers: headers,
      body: data
    }).then(() => {
      this.getFolderContent(this.state.currentFolderId)
    })
  }

  downloadFile(id) {
    const headers = this.setHeaders();
    fetch(`/api/storage/file/${id}`, {
      method: 'get',
      headers: headers
    }).then(async (data) => {
      const blob = await data.blob()
      const name = data.headers.get('x-file-name')
      fileDownload(blob, name)
    })
  }

  deleteItems() {
    const selectedItems = this.state.selectedItems
    const bucket = _.last(this.state.namePath).bucket
    const headers = this.setHeaders();
    const fetchOptions = {
      method: "DELETE",
      headers: headers
    }
    if (selectedItems.length === 0) return
    const deletionRequests = _.map(selectedItems, (v, i) => {
      const url = v.type === 'Folder' ? `/api/storage/folder/${v.id}` : `/api/storage/bucket/${bucket}/file/${v.bucket}`
      return fetch(url, fetchOptions)
    })
    Promise.all(deletionRequests)
      .then((result) => {
        console.log('about to delete');
        setTimeout(() => {
          console.log('deleteing');
          this.getFolderContent(this.state.currentFolderId, false)
        }, 100)
      }).catch((err) => {
        throw new Error(err)
      });
  }

  selectCommanderItem(i, e) {
    const selectedItems = this.state.selectedItems
    const id = e.target.getAttribute('data-id')
    const type = e.target.getAttribute('data-type')
    const bucket = e.target.getAttribute('data-bucket')
    if (_.some(selectedItems, { id })) {
      const indexOf = _.findIndex(selectedItems, o => o.id === id)
      console.log(indexOf);
      this.setState({
        selectedItems: update(selectedItems, { $splice: [[indexOf, 1]] })
      })
    } else {
      this.setState({
        selectedItems: update(selectedItems, { $push: [{ type, id, bucket }] })
      })
    }
    e.target.classList.toggle('selected')
  }

  deselectAll() {
    const el = document.getElementsByClassName('FileCommanderItem')
    for (let e of el) {
      e.classList.remove('selected')
    }
  }

  pushNamePath(path) {
    return update(this.state.namePath, { $push: [path] })
  }

  popNamePath() {
    return (previousState, currentProps) => {
      return { ...previousState, namePath: _.dropRight(previousState.namePath) };
    }
  }

  folderTraverseUp() {
    this.setState(this.popNamePath(), () => {
      this.getFolderContent(_.last(this.state.namePath).id, false)
    })
  }
  
  closeModal() {
    this.setState({chooserModalOpen: false})
  }

  render() {
    // return <KeyPage user={this.state.user} />;
    const isAuthorized = this.state.isAuthorized
    return (
      <div className="App">
        {
          isAuthorized ? (
            <Header 
              createFolder={this.createFolder}
              uploadFile={this.openUploadFile}
              uploadHandler={this.uploadFile}
              deleteItems={this.deleteItems}
              style
            />
          ) : null
        }
        {
          isAuthorized ? (
          <FileCommander
            //   folderTree={this.state.folderTree}
            currentCommanderItems={this.state.currentCommanderItems}
            openFolder={this.openFolder}
            downloadFile={this.downloadFile}
            selectCommanderItem={this.selectCommanderItem}
            namePath={this.state.namePath}
            handleFolderTraverseUp={this.folderTraverseUp.bind(this)}
          />
        ) : (
          <div className="loader__wrapper full-height">
            <Loader className="loader"/>
          </div>
        )
        }
        <Popup
          open={this.state.chooserModalOpen}
          closeOnDocumentClick
          onClose={this.closeModal}
        >
        <div>
          <a href={'xcloud://' + this.state.token + '://' + JSON.stringify(this.state.user)}>Open mobile app</a>
          <a onClick={this.closeModal}>Use web app</a>
        </div>
        </Popup>

        <Popup
          open={this.state.mnemonicModal}
          closeOnDocumentClick
          onClose={this.closeMnemonicModal}
        >
          <div>
            <div className="message-wrapper">
              <span>This is your mnemonic key: </span>
              <div><strong>{`${sessionStorage.getItem('xMnemonic')}. `}</strong></div>
              <span>If you lose it, you won't be able to access your data. </span>
              <p>We can save it in our database if you want?</p>
            </div>
            <div className="buttons-wrapper">
              <div className="default-button" onClick={this.closeMnemonicModal}>
                Close
          </div>
              <div className="default-button button-primary" onClick={this.saveMnemonicToDataase}>
                Save mnemonic
          </div>
            </div>
          </div>
        </Popup>
      </div>
    );
  }
}

export default App;

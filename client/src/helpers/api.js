/* global API_BASE_URL */
import superagent from 'superagent';
import Cookie from 'js-cookie';
import pages from '../schema/pages.json';
import posts from '../schema/posts.json';

const request = (method, url) => {
  return superagent(method, url).withCredentials();
};

const repoRequest = (method, url) => {
  return superagent(method, url)
    .set('X-REPO-OWNER', Cookie.get('repoOwner'))
    .set('X-REPO-NAME', Cookie.get('repoName'))
    .withCredentials();
};

const generalResponseHandler = (resolve, reject) => {
  return function(err, res) {
    if (err) {
      console.error(err);
      return reject(err);
    }
    return resolve(res.body);
  };
};

const setQueryParam = options => {
  var params = [];
  Object.keys(options).forEach(prop => {
    if (options[prop]) {
      params.push(`${prop}=${options[prop]}`);
    }
  });
  return '?' + params.join('&');
};

export function checkRepoAvailability(repoOwner, repoName) {
  return new Promise((resolve, reject) => {
    superagent('GET', `${API_BASE_URL}/api/repository/details`)
      .set('X-REPO-OWNER', repoOwner)
      .set('X-REPO-NAME', repoName)
      .withCredentials()
      .end(generalResponseHandler(resolve, reject));
  });
}

export function getUser() {
  return new Promise((resolve, reject) => {
    request('GET', `${API_BASE_URL}/api/me`).end(
      generalResponseHandler(resolve, reject)
    );
  });
}

export function logoutUser() {
  return new Promise((resolve, reject) => {
    request('GET', `${API_BASE_URL}/api/logout`).end(
      generalResponseHandler(resolve, reject)
    );
  });
}

export function getUserOrgs() {
  return new Promise((resolve, reject) => {
    request('GET', `${API_BASE_URL}/api/me/orgs`).end(
      generalResponseHandler(resolve, reject)
    );
  });
}

export function getUserRepos(opts) {
  var requestUrl = `${API_BASE_URL}/api/me/repos` + setQueryParam(opts || {});
  return new Promise((resolve, reject) => {
    request('GET', requestUrl).end(generalResponseHandler(resolve, reject));
  });
}

export function getRepoDetails() {
  return new Promise((resolve, reject) => {
    repoRequest('GET', `${API_BASE_URL}/api/repository/details`).end(
      generalResponseHandler(resolve, reject)
    );
  });
}

export function getRepoMeta({ branch, path, raw }) {
  var requestUrl =
    `${API_BASE_URL}/api/repository` + setQueryParam({ branch, path, raw });

  return new Promise((resolve, reject) => {
    repoRequest('GET', requestUrl).end(generalResponseHandler(resolve, reject));
  });
}

export function getRepoBranchList() {
  return new Promise((resolve, reject) => {
    repoRequest('GET', `${API_BASE_URL}/api/repository/branch`).end(
      generalResponseHandler(resolve, reject)
    );
  });
}

export function getRepoBranchDetails(branch) {
  return new Promise((resolve, reject) => {
    repoRequest(
      'GET',
      `${API_BASE_URL}/api/repository/branch` + setQueryParam({ branch })
    ).end(generalResponseHandler(resolve, reject));
  });
}

export function updateRepoFile({ branch, path, content, message, options }) {
  return new Promise((resolve, reject) => {
    repoRequest('POST', `${API_BASE_URL}/api/repository`)
      .send({
        branch,
        path,
        content,
        message: message || `update ${path}`,
        options
      })
      .end(generalResponseHandler(resolve, reject));
  });
}

export function deleteRepoFile({ branch, path }) {
  return new Promise((resolve, reject) => {
    repoRequest('DELETE', `${API_BASE_URL}/api/repository`)
      .send({ branch, path })
      .end(generalResponseHandler(resolve, reject));
  });
}

export function getRepoIndex({ branch, refresh }) {
  branch = branch ? branch : 'master';
  refresh = refresh ? refresh : false;
  var requestUrl = `${API_BASE_URL}/api/repository/index?branch=${branch}&refresh=${refresh}`;
  return new Promise((resolve, reject) => {
    repoRequest('GET', requestUrl).end(generalResponseHandler(resolve, reject));
  });
}

export function getUpdatedCollections({ branch = 'master' } = {}) {
  const requestUrl = `${API_BASE_URL}/api/repository/updated-collections?branch=${branch}`;
  return new Promise((resolve, reject) => {
    repoRequest('GET', requestUrl).end(generalResponseHandler(resolve, reject));
  });
}

export function getRepoTree(branch) {
  branch = branch ? branch : 'master';
  var requestUrl = `${API_BASE_URL}/api/repository/tree?branch=${branch}`;
  return new Promise((resolve, reject) => {
    repoRequest('GET', requestUrl).end(generalResponseHandler(resolve, reject));
  });
}

export function listRepoHooks() {
  var requestUrl = `${API_BASE_URL}/api/repository/hooks`;
  return new Promise((resolve, reject) => {
    repoRequest('GET', requestUrl).end(generalResponseHandler(resolve, reject));
  });
}

export function registerRepoHook() {
  var requestUrl = `${API_BASE_URL}/api/repository/hooks`;
  return new Promise((resolve, reject) => {
    repoRequest('POST', requestUrl)
      .send({ action: 'create' })
      .end(generalResponseHandler(resolve, reject));
  });
}

export function removeRepoHook() {
  var requestUrl = `${API_BASE_URL}/api/repository/hooks`;
  return new Promise((resolve, reject) => {
    repoRequest('POST', requestUrl)
      .send({ action: 'delete' })
      .end(generalResponseHandler(resolve, reject));
  });
}

export function checkJekyllProBuild(branch) {
  var requestUrl = `${API_BASE_URL}/api/status?branch=${branch}`;
  return new Promise((resolve, reject) => {
    repoRequest('GET', requestUrl).end(generalResponseHandler(resolve, reject));
  });
}

export function injectDefaultSchema(branch) {
  let pagesData = {
    branch,
    path: '_schemas/pages.json',
    content: JSON.stringify(pages, undefined, 2),
    message: 'Add default schema pages.json'
  };
  let postsData = {
    branch,
    path: '_schemas/posts.json',
    content: JSON.stringify(posts, undefined, 2),
    message: 'Add default schema posts.json'
  };

  return updateRepoFile(pagesData).then(res => {
    return updateRepoFile(postsData);
  });
}

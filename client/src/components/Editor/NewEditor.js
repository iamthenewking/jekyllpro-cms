import React, { Component } from 'react';
import Form from 'react-jsonschema-form';
import ReactDOM from 'react-dom';
import moment from 'moment';
import Cookie from 'js-cookie';
import { Link } from 'react-router';
import Select from 'react-select';

import {
  parseYamlInsideMarkdown,
  retriveContent,
  serializeObjtoYaml
} from '../../helpers/markdown';
import TrashIcon from '../svg/TrashIcon';
import MoreMenuIcon from '../svg/MoreMenuIcon';
import CheckIcon from '../svg/CheckIcon';
import BackArrowIcon from '../svg/BackArrowIcon';
import CaretDownIcon from '../svg/CaretDownIcon';
import LockIcon from '../svg/LockIcon';

import customWidgets from '../JSONSchemaForm/CustomWidgets';
import CustomArrayField from '../JSONSchemaForm/CustomArrayField';
import {
  slugify,
  purgeObject,
  textValueIsDifferent,
  parseFilePath,
  parseNameFromFilePath,
  parseFilePathByLang
} from '../../helpers/utils';
import notify from '../common/Notify';

const fileExtMapping = ext => {
  switch (ext) {
    case 'md':
      return 'Markdown';
    case 'html':
      return 'HTML';
    default:
      return ext;
  }
};

export default class NewEditor extends Component {
  constructor(props) {
    super(props);
    this.state = {
      currentFilePath: '',
      currentFileSlug: undefined,
      currentFileExt: undefined,
      currentFileLanguage: undefined,
      isPostPublished: true,
      isDraft: false,
      language: 'cn',
      filePathInputClass: '',
      formData: {},
      currentSchema: null,
      disableActionBtn: false,
      subPath: '',
      title: '',
      shouldRenderTitle: false,
      titleTitle: 'Title',
      showFilename: false
    };
  }

  componentWillMount() {
    const { collections, params, config, location: { query } } = this.props;

    if (query.baseFile && query.language) {
      let validBaseFile = collections.find(item => {
        return item.path === query.baseFile;
      });
      if (validBaseFile) {
        return this.getCurrentSchema(
          params.collectionType,
          this.updateEditorForm(validBaseFile, query.language)
        );
      }
    }

    this.getCurrentSchema(params.collectionType, () => {
      this.setState(
        {
          availableLanguages: config && config.languages,
          translations: undefined,
          formData: {},
          currentFileSlug: slugify('untitled'),
          currentFileExt: 'md',
          currentFileLanguage:
            (config && config.languages && config.languages[0].code) ||
            undefined
        },
        () => {
          this.updateCurrentFilePath();
        }
      );
    });
  }

  getCurrentSchema(type, callback) {
    let { schemas } = this.props;
    schemas = schemas ? schemas : [];

    let schema = schemas.find(item => {
      return item.jekyll.id === type;
    });

    let shouldRenderTitle = false;
    let titleTitle = 'Title';
    if (
      schema.JSONSchema &&
      schema.JSONSchema.properties &&
      schema.JSONSchema.properties.title
    ) {
      if (schema.JSONSchema.properties.title.title) {
        titleTitle = schema.JSONSchema.properties.title.title;
      }
      let required = [];
      if (schema.JSONSchema.required) {
        schema.JSONSchema.required.forEach(item => {
          if (item === 'title') {
            titleTitle += '*';
          } else {
            required.push(item);
          }
        });
      }
      schema.JSONSchema.required = required;
      delete schema.JSONSchema.properties.title;
      shouldRenderTitle = true;
    }

    this.setState(
      {
        shouldRenderTitle,
        titleTitle,
        currentSchema: schema
      },
      callback
    );
  }

  updateEditorForm(collectionFile, langCode) {
    return () => {
      const { content, path } = collectionFile;
      const { currentSchema } = this.state;
      if (!content) return;
      let formData = {};

      // content is markdown or html
      const docConfigObj = parseYamlInsideMarkdown(content);
      // console.log(docConfigObj)
      if (docConfigObj) {
        const schemaObj = currentSchema.JSONSchema.properties;
        Object.keys(schemaObj).forEach(prop => {
          formData[prop] = docConfigObj[prop];
        });
        formData.published = docConfigObj.published;
        formData.draft = docConfigObj.draft;
        // formData.lang = docConfigObj.lang
        formData.body = retriveContent(content);
      } else {
        formData.body = content;
      }

      this.setState(
        {
          formData,
          title: docConfigObj && docConfigObj['title'],
          isPostPublished:
            formData.published !== undefined ? formData.published : true,
          isDraft: formData.draft !== undefined ? formData.draft : false,
          currentFileLanguage: langCode
        },
        () => {
          this.setParsedFileProps(path, langCode);
        }
      );
    };
  }

  setParsedFileProps(fullFilePath, langCode) {
    const { config } = this.props;
    const { currentSchema } = this.state;
    let rootFolder =
      currentSchema.jekyll.id === 'pages' ? '/' : currentSchema.jekyll.dir;
    let langs = (config && config.languages) || undefined;
    let parsedObj = parseFilePath(fullFilePath, langs, rootFolder);
    // console.log(parsedObj)
    this.setState(
      {
        subPath: parsedObj.subPath,
        currentFileSlug: parsedObj.fileSlug,
        currentFileExt: parsedObj.fileExt,
        currentFileLanguage: langCode
      },
      () => {
        this.updateCurrentFilePath();
      }
    );
  }

  onFormSubmit = ({ formData: data }) => {
    const formData = Object.assign({}, data);
    const {
      selectCollectionFile,
      currentBranch,
      addNewFile,
      collectionFileAdded,
      toRoute,
      params: { repoOwner, repoName, collectionType, branch, splat }
    } = this.props;
    const {
      currentSchema,
      isPostPublished,
      isDraft,
      language,
      currentFileLanguage,
      title
    } = this.state;
    const filePath = this.state.currentFilePath;

    if (!this.state.currentFileSlug) {
      console.error('no file name specified');
      this.setState({ filePathInputClass: 'error' });
      return;
    }
    let updatedContent = formData.body;
    delete formData.body;

    if (isPostPublished === false) {
      formData.published = false;
    } else {
      delete formData.published;
    }
    if (isDraft === true) {
      formData.draft = true;
    } else {
      delete formData.draft;
    }
    if (currentFileLanguage) {
      formData.lang = currentFileLanguage;
    }
    if (false === this.isDefaultLanguage()) {
      formData.categories = currentFileLanguage;
    }
    if (title !== '') {
      formData.title = title;
    }
    // delete all undefined property
    purgeObject(formData);

    this.setState({ disableActionBtn: true, formData: data });

    updatedContent = serializeObjtoYaml(formData) + updatedContent;

    addNewFile(currentBranch, filePath, updatedContent)
      .then(data => {
        let newItem = {
          path: filePath,
          content: updatedContent,
          collectionType: collectionType,
          lastUpdatedAt: data.commit.committer.date,
          lastUpdatedBy: data.commit.committer.name,
          lastCommitSha: data.commit.sha
        };
        collectionFileAdded(newItem);
        selectCollectionFile(newItem);
        toRoute(
          `/${repoOwner}/${repoName}/${collectionType}/${branch}/${filePath}`
        );
        this.setState({ disableActionBtn: false });
      })
      .then(() => {
        notify('success', 'Change saved!');
      })
      .catch(err => {
        this.setState({ disableActionBtn: false });
        notify('error', 'Unable to complete the operation!');
      });
  };

  handleSaveBtn() {
    let clickEvt = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true
    });
    ReactDOM.findDOMNode(this.refs.formSubmitBtn).dispatchEvent(clickEvt);
  }

  changeFileLanguage(langCode) {
    this.setState({ currentFileLanguage: langCode }, () => {
      this.updateCurrentFilePath();
    });
  }

  handlePublishInput(evt) {
    const { isPostPublished } = this.state;
    this.setState({ isPostPublished: !isPostPublished });
  }

  handleDraftInput(evt) {
    const { isDraft } = this.state;
    this.setState({ isDraft: !isDraft });
  }

  handleFileSlugInput = evt => {
    this.setState({ currentFileSlug: evt.target.value }, () => {
      this.updateCurrentFilePath();
    });
  };

  handleSlugSelect(selected) {
    this.setState({ currentFileExt: selected.value }, () => {
      this.updateCurrentFilePath();
    });
  }

  isDefaultLanguage = () => {
    const { config } = this.props;
    const { currentFileLanguage } = this.state;
    if (
      config &&
      config.languages &&
      currentFileLanguage !== config.languages[0].code
    ) {
      return false;
    }
    return true;
  };

  handleTitleOnChange = evt => {
    // slug is like "2017-05-25-hello-world"
    // no directory name and extension
    const val = evt.target.value;
    const { location: { query } } = this.props;
    if (query.baseFile && query.language) {
      // this new entry is created from existing one
      return this.setState({
        title: val
      });
    } else {
      return this.setState(
        {
          title: val,
          currentFileSlug: slugify(val === '' ? 'untitled' : val)
        },
        () => {
          this.updateCurrentFilePath();
        }
      );
    }
  };

  handleShowFilename = evt => {
    evt.preventDefault();
    this.setState({
      showFilename: true
    });
  };

  handleHideFilename = evt => {
    evt.preventDefault();
    this.setState({
      showFilename: false
    });
  };

  updateCurrentFilePath() {
    const {
      currentFileSlug,
      currentFileExt,
      currentFileLanguage,
      currentSchema,
      subPath
    } = this.state;
    let newPathArray = [];
    let newFilename = currentFileExt
      ? currentFileSlug + '.' + currentFileExt
      : currentFileSlug;
    if (currentSchema.jekyll.id !== 'pages') {
      newPathArray.push(currentSchema.jekyll.dir);
    }
    if (false === this.isDefaultLanguage()) {
      newPathArray.push(currentFileLanguage);
    }
    if (subPath !== '') {
      newPathArray.push(subPath);
    }
    newPathArray.push(newFilename);
    this.setState({ currentFilePath: newPathArray.join('/') });
  }

  toContentListing() {
    const { toRoute, repoFullName } = this.props;
    toRoute(`/${repoFullName}/`);
  }

  onFormChange = ({ formData }) => {
    this.setState({
      formData
    });
  };

  renderTitle = () => {
    const {
      shouldRenderTitle,
      currentFileSlug,
      currentFilePath,
      showFilename,
      titleTitle,
      title
    } = this.state;
    if (shouldRenderTitle === false) return null;
    return (
      <div>
        <div className="field title">
          <label>
            {titleTitle}
          </label>
          <input
            type="text"
            value={title}
            onChange={this.handleTitleOnChange}
          />
          {showFilename === false
            ? <small className="description">
                <strong>File path: </strong>
                {currentFilePath}
                {'  '}
                (<a href="javascript:;" onClick={this.handleShowFilename}>
                  edit
                </a>)
              </small>
            : null}
        </div>
        {showFilename === true
          ? <div className="field filename">
              <label>
                Filename{'  '}(<a
                  href="javascript:;"
                  onClick={this.handleHideFilename}
                >
                  hide
                </a>)
              </label>
              <input
                type="text"
                value={currentFileSlug}
                onChange={this.handleFileSlugInput}
              />
              <small className="description">
                <strong>File path: </strong>
                {currentFilePath}
              </small>
            </div>
          : null}
      </div>
    );
  };

  // not used
  renderSlug = () => {
    return (
      <div className="field slug">
        <label>Slug</label>
        <input
          className={`${filePathInputClass}`}
          type="text"
          value={currentFileSlug}
          onChange={::this.handleFileSlugInput}
          placeholder="File slug"
          readOnly
        />
        <small className="description">
          <strong>File path: </strong>
          {currentFilePath}
        </small>
      </div>
    );
  };

  // not used
  renderFormat = () => {
    return (
      <div className="field format">
        <label>Format</label>
        <Select
          clearable={false}
          value={this.state.currentFileExt}
          options={[
            { value: 'md', label: 'Markdown' },
            { value: 'html', label: 'HTML' }
          ]}
          onChange={::this.handleSlugSelect}
        />
      </div>
    );
  };

  render() {
    const {
      editorUpdating,
      location: { query },
      params,
      schemas,
      config,
      repoFullName,
      currentBranch
    } = this.props;
    const {
      filePathInputClass,
      formData,
      currentFilePath,
      availableLanguages,
      currentSchema,
      disableActionBtn,
      currentFileSlug
    } = this.state;

    if (!currentSchema) return <section id="content" />;

    return (
      <section id="content">
        <header className="header">
          <div className="controls">
            <span className={disableActionBtn ? 'bundle disabled' : 'bundle'}>
              <button
                className={
                  disableActionBtn
                    ? 'button primary save processing'
                    : 'button primary save'
                }
                onClick={::this.handleSaveBtn}
              >
                Save
              </button>

              <span className="menu">
                <button className="button icon primary">
                  <MoreMenuIcon />
                </button>
                <div className="options">
                  <a
                    className={
                      this.state.isPostPublished ? 'selected' : 'disabled'
                    }
                    onClick={::this.handlePublishInput}
                  >
                    <CheckIcon />
                    <span>Published</span>
                  </a>
                  <a
                    className={this.state.isDraft ? 'selected' : 'disabled'}
                    onClick={::this.handleDraftInput}
                  >
                    <CheckIcon />
                    <span>Draft</span>
                  </a>
                </div>
              </span>
            </span>
          </div>
          <button
            className="button icon tooltip-bottom"
            onClick={::this.toContentListing}
          >
            <BackArrowIcon />
            <span>Back to all content</span>
          </button>
        </header>

        <div className="body">
          {config &&
            config.languages &&
            <div className="field language">
              <label>Language</label>
              {(query.language &&
                <span className="menu">
                  <button className="button active locked">
                    {config.languages
                      .filter(lang => {
                        return lang.code === this.state.currentFileLanguage;
                      })
                      .map(language => {
                        return (
                          <span key={language.code}>
                            {language.name}&nbsp;
                          </span>
                        );
                      })}
                    <LockIcon />
                  </button>
                </span>) ||
                <span className="menu">
                  <button className="button">
                    {config.languages
                      .filter(lang => {
                        return lang.code === this.state.currentFileLanguage;
                      })
                      .map(language => {
                        return (
                          <span key={language.code}>
                            {language.name}
                          </span>
                        );
                      })}
                    <CaretDownIcon />
                  </button>
                  <div className="options">
                    {config.languages.map(lang => {
                      return (
                        <a
                          key={lang.code}
                          onClick={this.changeFileLanguage.bind(
                            this,
                            lang.code
                          )}
                          className={
                            this.state.currentFileLanguage === lang.code
                              ? 'selected'
                              : ''
                          }
                        >
                          <CheckIcon />
                          {lang.name}
                        </a>
                      );
                    })}
                  </div>
                </span>}
            </div>}

          {this.renderTitle()}

          <Form
            onChange={this.onFormChange}
            onSubmit={this.onFormSubmit}
            schema={currentSchema.JSONSchema}
            uiSchema={currentSchema.uiSchema}
            fields={{ ArrayField: CustomArrayField }}
            widgets={customWidgets}
            showErrorList={false}
            formData={formData}
          >
            <button
              type="submit"
              ref="formSubmitBtn"
              style={{ display: 'none' }}
            >
              Submit
            </button>
          </Form>
        </div>
      </section>
    );
  }
}

import React from "react";
import ContentEditable from "react-contenteditable";
import getSelection from "./utils/getSelection";
import getCaretCoordinates from "./utils/getCaretCoordinates";

import COLORS from "./constants/colors";
import styled from "styled-components";
import FloatingButton from "./FloatingButton";
import setCaretToEnd from "./utils/setCaretToEnd";

import "./styles.css";
import SelectMenu from "./SelectMenu";

const CMD_KEY = "/";

class EditableBlock extends React.Component {
  constructor(props) {
    super(props);
    this.contentEditable = React.createRef();
    this.state = {
      // htmlBackup: null,
      html: "",
      tag: "p",
      flag: 0,
      previousKey: null,
      actionMenuOpen: false,
      actionMenuPosition: { x: null, y: null },
      selectionStart: 0,
      selectionEnd: 0,
      selectMenuIsOpen: false,
      selectMenuPosition: {
        x: null,
        y: null,
      },
    };
    this.onChangeHandler = this.onChangeHandler.bind(this);
    this.onKeyDownHandler = this.onKeyDownHandler.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.calculateActionMenuPosition =
      this.calculateActionMenuPosition.bind(this);
    this.openActionMenu = this.openActionMenu.bind(this);
    this.closeActionMenu = this.closeActionMenu.bind(this);

    this.onKeyUpHandler = this.onKeyUpHandler.bind(this);
    this.openSelectMenuHandler = this.openSelectMenuHandler.bind(this);
    this.closeSelectMenuHandler = this.closeSelectMenuHandler.bind(this);
    this.tagSelectionHandler = this.tagSelectionHandler.bind(this);
  }

  componentDidMount() {
    this.setState({
      ...this.state,
      html: this.props.html,
      tag: this.props.tag,
      flag: this.props.flag,
    });
    // set eventListener
    this.contentEditable.current.addEventListener("paste", (e) => {
      e.preventDefault();

      // get plain text
      let text = (e.originalEvent || e).clipboardData.getData("text/plain");
      this.setState({ html: this.state.html + text });
    });
  }

  componentWillUnmount() {
    // In case, the user deleted the block, we need to cleanup all listeners
    document.removeEventListener("click", this.closeActionMenu, false);
  }

  // component render 최적화
  shouldComponentUpdate(nextProps, nextState) {
    if (
      this.state.html !== nextState.html ||
      this.state.flag !== nextState.flag ||
      this.state.actionMenuOpen !== nextState.actionMenuOpen ||
      this.state.selectMenuIsOpen !== nextState.selectMenuIsOpen
    ) {
      return true;
    }
    return false;
  }

  componentDidUpdate(prevProps, prevState) {
    const htmlChanged = prevState.html !== this.state.html;
    const tagChanged = this.props.tag !== this.state.tag;
    const blockChanged = prevState.flag !== this.state.flag;

    if (htmlChanged || tagChanged || blockChanged) {
      this.props.updatePage({
        id: this.props.id,
        html: this.state.html,
        tag: this.state.tag,
        flag: this.state.flag,
      });
    }
  }

  onChangeHandler(e) {
    this.setState({
      ...this.state,
      html: e.target.value,
    });
  }

  onKeyDownHandler(e) {
    if (e.key === CMD_KEY) {
      // If the user starts to enter a command, we store a backup copy of
      // the html. We need this to restore a clean version of the content
      // after the content type selection was finished.
      this.setState({ htmlBackup: this.state.html });
      console.log("onKeyDownHandler", "실행됌");
    }
    if (e.key === "Enter") {
      if (
        e.nativeEvent.isComposing === false &&
        this.state.previousKey !== "Shift" &&
        !this.state.selectMenuIsOpen
      ) {
        e.preventDefault();
        const { selectionStart } = getSelection(this.contentEditable.current);
        this.props.addBlock({
          command: e.key,
          id: this.props.id,
          html: this.state.html,
          position: selectionStart,
          flag: this.state.flag,
          ref: this.contentEditable.current,
        });
      }
    } else if (
      e.key === "Backspace" &&
      (this.state.html === "" || this.state.html === "<br>")
    ) {
      e.preventDefault();
      this.props.deleteBlock({
        command: e.key,
        id: this.props.id,
        ref: this.contentEditable.current,
      });
    }

    if (e.key !== "Enter") {
      this.setState({ previousKey: e.key });
    }
  }

  calculateActionMenuPosition(parent, initiator) {
    switch (initiator) {
      case "TEXT_SELECTION":
        const { x: endX, y: endY } = getCaretCoordinates(false); // fromEnd
        const { x: startX, y: startY } = getCaretCoordinates(true); // fromStart
        const middleX = startX + (endX - startX) / 2;

        return { x: middleX, y: endY + startY - startY };
      default:
        return { x: null, y: null };
    }
  }
  openActionMenu(parent, trigger, start, end) {
    // floating point x, y value
    const { x, y } = this.calculateActionMenuPosition(parent, trigger);
    this.setState({
      ...this.state,
      actionMenuPosition: { x: x, y: y },
      actionMenuOpen: true,
      selectionStart: start,
      selectionEnd: end,
    });

    // Add listener asynchronously to avoid conflicts with
    // the double click of the text selection
    setTimeout(() => {
      document.addEventListener("click", this.closeActionMenu, false);
    }, 100);
  }
  closeActionMenu() {
    this.setState({
      ...this.state,
      actionMenuPosition: { x: null, y: null },
      actionMenuOpen: false,
    });
    document.removeEventListener("click", this.closeActionMenu, false);
  }

  handleMouseUp() {
    const block = this.contentEditable.current;
    const { selectionStart, selectionEnd } = getSelection(block);
    if (selectionStart !== selectionEnd) {
      // set position
      this.setState({
        ...this.state,
        selectionStart: selectionStart,
        selectionEnd: selectionEnd,
      });
      this.openActionMenu(
        block,
        "TEXT_SELECTION",
        selectionStart,
        selectionEnd
      );
    }
  }

  onKeyUpHandler(e) {
    if (e.key === CMD_KEY) {
      this.openSelectMenuHandler();
      console.log("onKeyUpHandler", "실행됌");
    }
  }

  // After openening the select menu, we attach a click listener to the dom that
  // closes the menu after the next click - regardless of outside or inside menu.
  openSelectMenuHandler() {
    const { x, y } = getCaretCoordinates();
    this.setState({
      selectMenuIsOpen: true,
      selectMenuPosition: { x, y },
    });
    document.addEventListener("click", this.closeSelectMenuHandler);
  }

  closeSelectMenuHandler() {
    this.setState({
      htmlBackup: null,
      selectMenuIsOpen: false,
      selectMenuPosition: { x: null, y: null },
    });
    document.removeEventListener("click", this.closeSelectMenuHandler);
  }

  // Restore the clean html (without the command), focus the editable
  // with the caret being set to the end, close the select menu
  tagSelectionHandler(tag) {
    this.setState({ tag: tag, html: this.state.htmlBackup }, () => {
      setCaretToEnd(this.contentEditable.current);
      this.closeSelectMenuHandler();
    });
    console.log("tagSelectionHandler", "실행됌");
  }

  render() {
    return (
      <>
        {this.state.actionMenuOpen && (
          <FloatingButton
            position={this.state.actionMenuPosition}
            actions={{
              turnIntoBlock: () =>
                this.props.updateBlock({
                  id: this.props.id,
                  html: this.state.html,
                  tag: this.state.tag,
                  flag: this.state.flag,
                  startPoint: this.state.selectionStart,
                  endPoint: this.state.selectionEnd,
                }),
            }}
          />
        )}

        {this.state.selectMenuIsOpen && (
          <SelectMenu
            position={this.state.selectMenuPosition}
            onSelect={this.tagSelectionHandler}
            close={this.closeSelectMenuHandler}
          />
        )}
        <Block
          innerRef={this.contentEditable}
          html={this.state.html}
          flag={this.props.flag}
          tagName={this.state.tag}
          onChange={this.onChangeHandler}
          onKeyUp={this.onKeyUpHandler}
          onKeyDown={this.onKeyDownHandler}
          onMouseUp={this.handleMouseUp}
          className={this.props.id}
        />
      </>
    );
  }
}

const Block = styled(ContentEditable)`
  width: 96%;

  padding: 4px 9px;
  margin-top: 5px;

  background: ${({ flag }) => (flag ? COLORS.blockBackground : "none")};
  border: ${({ flag }) => (flag ? "1px solid #5274EF" : "none")};
  border-radius: 2px;
  border: 1px solid #e0e0e0;
  /* 
  font-weight: 400;
  font-size: 12px; */
  /* line-height: 18px; */

  letter-spacing: -0.005em;

  ::selection {
    background-color: #cbe5f3;
  }

  &:focus {
    outline: 1px solid #5274ef;
  }
`;

export default EditableBlock;

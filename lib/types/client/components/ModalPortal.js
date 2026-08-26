import { jsx as _jsx } from "react/jsx-runtime";
import { createPortal } from 'react-dom';
export function ModalPortal({ backdropClass, modalClass, onBackdropClose, children }) {
    return createPortal(_jsx("div", { className: 'dshb-backdrop' + (backdropClass ? ' ' + backdropClass : ''), onClick: onBackdropClose
            ? (e) => { e.stopPropagation(); onBackdropClose(); }
            : undefined, children: _jsx("div", { className: 'dshb-modal' + (modalClass ? ' ' + modalClass : ''), onClick: (e) => e.stopPropagation(), children: children }) }), document.body);
}

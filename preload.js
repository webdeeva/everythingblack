const style = document.createElement('style');
style.textContent = `
::-webkit-scrollbar {
    width: 12px;
}

::-webkit-scrollbar-track {
    background: #050505;
}

::-webkit-scrollbar-thumb {
    background: #c44901;
    border-radius: 6px;
}

::-webkit-scrollbar-thumb:hover {
    background: #933600;
}
`;
document.head.appendChild(style);

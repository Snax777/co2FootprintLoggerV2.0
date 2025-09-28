import { useState, createContext, useContext } from "react";

const AppContext = createContext();
const AuthProvider = ({children}) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");

    return (
        <AppContext.Provider value={
            {
                isLoggedIn, 
                setIsLoggedIn, 
                email, 
                setEmail, 
                username, 
                setUsername
            }}>
            {children}
        </AppContext.Provider>
    )
};
const useAppContext = () => useContext(AppContext);

export {AuthProvider, useAppContext};
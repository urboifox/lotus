import { configureStore } from "@reduxjs/toolkit";
import dataReducer from "./dataSlice";
import optionsReducer from "./optionsSlice";
export const store = configureStore({
  reducer: {
    data: dataReducer,
    options: optionsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

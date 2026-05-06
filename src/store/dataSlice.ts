import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { ReactNode } from "react";

export interface dataState {
  content: string | ReactNode;
}
const initialState: dataState = {
  content: sessionStorage.getItem("content") || "",
};
export const dataSlice = createSlice({
  name: "data",
  initialState,
  reducers: {
    setData: (state, action: PayloadAction<string | ReactNode>) => {
      state.content = action.payload;
      // window.sessionStorage.setItem("content", state.content);
    },
  },
});

export const { setData } = dataSlice.actions;

export default dataSlice.reducer;

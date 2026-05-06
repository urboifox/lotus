import { apiClient } from "@/config/axios.config";
import useCustomQuery from "@/config/useCustomQuery";
import { useMutation } from "@tanstack/react-query";

export interface LotusDocument {
  id: string;
  title: string;
  updated_at: string;
  created_at?: string;
  approx_lines: number;
  privacy: string;
  html?: string;
  is_shared?: boolean;
  is_owner?: boolean;
  can_edit?: boolean;
  active_editor_user_id?: string | null;
  active_editor_name?: string | null;
  lock_acquired_at?: string | null;
  lock_expires_at?: string | null;
  is_locked?: boolean;
  is_locked_by_me?: boolean;
  owner_subscription_active?: boolean | null;
}

export interface ShareLinkStatus {
  document_id?: string | null;
  is_shared: boolean;
  share_token?: string | null;
  share_url?: string | null;
  can_edit?: boolean;
  created_at?: string | null;
  revoked_at?: string | null;
  expires_at?: string | null;
}

export interface ShareAccessUser {
  id: string;
  document_id: string;
  user_id: string;
  shared_with_user_id: string;
  shared_with_user_name: string;
  shared_with_email?: string | null;
  status: string;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShareUserResult {
  email: string;
  status: string;
  message: string;
  shared_with_user_id?: string | null;
  shared_with_user_name?: string | null;
  shared_with_email?: string | null;
  can_edit: boolean;
  email_sent?: boolean;
  email_status?: string | null;
}

export interface ShareUsersResponse {
  document_id: string;
  results: ShareUserResult[];
  shares: ShareAccessUser[];
}

export interface DocumentLockStatus {
  document_id: string;
  is_locked: boolean;
  is_locked_by_me: boolean;
  active_editor_user_id?: string | null;
  active_editor_name?: string | null;
  session_id?: string | null;
  locked_at?: string | null;
  expires_at?: string | null;
  message?: string | null;
  can_edit?: boolean | null;
  owner_subscription_active?: boolean | null;
}

// Get all documents
export const GetAllDocuments = () => {
  const { data, isLoading, error, refetch } = useCustomQuery({
    queryKey: ["documents"],
    url: "/documents-html",
  });
  return { data, isLoading, error, refetch };
};

// Get document by ID
export const GetDocumentById = (id: string, lock = false) => {
  const { data, isLoading, error, refetch } = useCustomQuery({
    queryKey: ["document", id, lock ? "lock" : "view"],
    url: `/documents-html/${id}`,
    config: { params: { lock } },
    enabled: !!id,
    staleTime: 0,
  });
  return { data, isLoading, error, refetch };
};

export const GetSharedDocumentByToken = (shareToken: string) => {
  const { data, isLoading, error, refetch } = useCustomQuery({
    queryKey: ["shared-document", shareToken],
    url: `/share/${encodeURIComponent(shareToken)}`,
    enabled: !!shareToken,
    retry: 4,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8_000),
    staleTime: 0,
  });
  return { data, isLoading, error, refetch };
};

export const GetSharedDocumentById = (documentId: string) => {
  const { data, isLoading, error, refetch } = useCustomQuery({
    queryKey: ["shared-document-id", documentId],
    url: `/documents-html/${documentId}`,
    enabled: !!documentId,
    retry: 4,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8_000),
    staleTime: 0,
  });
  return { data, isLoading, error, refetch };
};

// Save/Create document
export const useSaveDocument = () => {
  return useMutation({
    mutationFn: async (documentData: { title: string; html: string }) => {
      const { data } = await apiClient.post("/documents-html", documentData);
      return data;
    },
  });
};

// Update document
export const useUpdateDocument = () => {
  return useMutation({
    mutationFn: async ({
      id,
      documentData,
      lockSessionId,
      shareToken,
    }: {
      id?: string;
      documentData: { title: string; html: string };
      lockSessionId?: string;
      shareToken?: string;
    }) => {
      const headers = lockSessionId
        ? { "x-file-edit-session": lockSessionId }
        : undefined;
      const url = shareToken
        ? `/share/${encodeURIComponent(shareToken)}`
        : `/documents-html/${id}`;
      const { data } = await apiClient.put(url, documentData, { headers });
      return data;
    },
  });
};

// Delete document
export const useDeleteDocument = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/documents-html/${id}`);
      return data;
    },
  });
};

export const useCreateShareLink = () => {
  return useMutation({
    mutationFn: async ({
      documentId,
      canEdit = false,
    }: {
      documentId: string;
      canEdit?: boolean;
    }) => {
      const { data } = await apiClient.post<ShareLinkStatus>(
        `/documents-html/${documentId}/share-link`,
        { can_edit: canEdit },
      );
      return data;
    },
  });
};

export const useRevokeShareLink = () => {
  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data } = await apiClient.delete<ShareLinkStatus>(
        `/documents-html/${documentId}/share-link`,
      );
      return data;
    },
  });
};

export async function getShareLinkStatus(
  documentId: string,
): Promise<ShareLinkStatus> {
  const { data } = await apiClient.get<ShareLinkStatus>(
    `/documents-html/${documentId}/share-link`,
  );
  return data;
}

export async function getShareUsers(documentId: string): Promise<ShareAccessUser[]> {
  const { data } = await apiClient.get<ShareAccessUser[]>(
    `/documents-html/${documentId}/share`,
  );
  return data;
}

export const useShareWithUsers = () => {
  return useMutation({
    mutationFn: async ({
      documentId,
      emails,
      canEdit = false,
    }: {
      documentId: string;
      emails: string[];
      canEdit?: boolean;
    }) => {
      const { data } = await apiClient.post<ShareUsersResponse>(
        `/documents-html/${documentId}/share/users`,
        { emails, can_edit: canEdit },
      );
      return data;
    },
  });
};

export const useRevokeShareUser = () => {
  return useMutation({
    mutationFn: async ({
      documentId,
      sharedWithUserId,
    }: {
      documentId: string;
      sharedWithUserId: string;
    }) => {
      await apiClient.delete(
        `/documents-html/${documentId}/share/${sharedWithUserId}`,
      );
      return { documentId, sharedWithUserId };
    },
  });
};

export async function acquireDocumentLock(params: {
  documentId?: string;
  shareToken?: string;
  sessionId: string;
}): Promise<DocumentLockStatus> {
  const path = params.shareToken
    ? `/share/${encodeURIComponent(params.shareToken)}/lock`
    : `/documents-html/${params.documentId}/lock`;
  const { data } = await apiClient.post<DocumentLockStatus>(path, {
    session_id: params.sessionId,
  });
  return data;
}

export async function heartbeatDocumentLock(params: {
  documentId?: string;
  shareToken?: string;
  sessionId: string;
}): Promise<DocumentLockStatus> {
  const path = params.shareToken
    ? `/share/${encodeURIComponent(params.shareToken)}/lock/heartbeat`
    : `/documents-html/${params.documentId}/lock/heartbeat`;
  const { data } = await apiClient.post<DocumentLockStatus>(path, {
    session_id: params.sessionId,
  });
  return data;
}

export async function releaseDocumentLock(params: {
  documentId?: string;
  shareToken?: string;
  sessionId: string;
}): Promise<DocumentLockStatus> {
  const path = params.shareToken
    ? `/share/${encodeURIComponent(params.shareToken)}/lock/release`
    : `/documents-html/${params.documentId}/lock/release`;
  const { data } = await apiClient.post<DocumentLockStatus>(path, {
    session_id: params.sessionId,
  });
  return data;
}

import React, { useState, useEffect } from "react";
import { apiClient } from "../services/api";

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "INVESTIGATOR" | "WHISTLEBLOWER";
  is_active: boolean;
  allowed_case_types: string[] | null;
  created_at: string;
}

const CASE_TYPES = ["Bribery", "Procurement Fraud", "Abuse of Office", "Embezzlement", "Nepotism", "Other"];

const roleColor = (role: string) => {
  if (role === "ADMIN")       return "bg-rose-500/10 text-rose-500 border-rose-500/20";
  if (role === "INVESTIGATOR") return "bg-blue-500/10 text-blue-500 border-blue-500/20";
  return "bg-slate-500/10 text-slate-400 border-slate-500/20";
};

const activeColor = (active: boolean) =>
  active ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20";

export const UserManagement: React.FC = () => {
  const [users, setUsers]         = useState<StaffUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData]   = useState({
    name: "", email: "", password: "", password_confirmation: "",
    role: "INVESTIGATOR" as "ADMIN" | "INVESTIGATOR",
    is_active: true,
    allowed_case_types: [] as string[],
  });
  const [submitError, setSubmitError]   = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [resetResult, setResetResult]   = useState<{ userId: string; tempPassword: string } | null>(null);
  const [togglingId, setTogglingId]     = useState<string | null>(null);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getUsers();
      if (response.success && Array.isArray(response.data)) {
        setUsers(response.data);
      } else {
        setError("Failed to fetch users");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", email: "", password: "", password_confirmation: "", role: "INVESTIGATOR", is_active: true, allowed_case_types: [] });
    setEditingId(null);
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitError(null);
    try {
      const response = editingId
        ? await apiClient.updateUser(editingId, formData)
        : await apiClient.createUser(formData);

      if (response.success) {
        await fetchUsers();
        setShowForm(false);
        resetForm();
      } else {
        setSubmitError(
          response.errors
            ? Object.values(response.errors).flat().join(", ")
            : response.message,
        );
      }
    } catch (err: any) {
      setSubmitError(err.message || "Failed to save user");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      const response = await apiClient.deleteUser(id);
      if (response.success) await fetchUsers();
      else setError(response.message || "Failed to delete user");
    } catch (err: any) {
      setError(err.message || "Failed to delete user");
    }
  };

  const handleToggleActive = async (id: string) => {
    setTogglingId(id);
    try {
      const response = await apiClient.toggleUserActive(id);
      if (response.success) await fetchUsers();
      else setError(response.message || "Failed to toggle status");
    } catch (err: any) {
      setError(err.message || "Failed to toggle status");
    } finally {
      setTogglingId(null);
    }
  };

  const handleResetPassword = async (id: string, name: string) => {
    if (!window.confirm(`Reset password for ${name}? A temporary password will be generated.`)) return;
    try {
      const response = await apiClient.resetUserPassword(id);
      if (response.success) {
        setResetResult({ userId: id, tempPassword: response.data.temporary_password });
      } else {
        setError(response.message || "Failed to reset password");
      }
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    }
  };

  const toggleCaseType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      allowed_case_types: prev.allowed_case_types.includes(type)
        ? prev.allowed_case_types.filter(t => t !== type)
        : [...prev.allowed_case_types, type],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
          <p className="text-rose-400 text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">User Management</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage admin and investigator accounts</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-sm rounded-xl transition-all">
          {showForm ? "Cancel" : "+ New User"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-6">
          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-5">
            {editingId ? "Edit User" : "Create New User"}
          </h3>
          {submitError && (
            <div className="mb-5 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <p className="text-rose-400 text-sm font-bold">{submitError}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Full Name</label>
                <input type="text" placeholder="Full name" required
                  value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-medium" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Email Address</label>
                <input type="email" placeholder="name@zacc.org.zw" required
                  value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-medium" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Role</label>
                <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-medium">
                  <option value="INVESTIGATOR">Investigator</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Password {editingId && "(leave blank to keep)"}</label>
                <input type="password" placeholder="••••••••" required={!editingId}
                  value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-medium" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Confirm Password</label>
                <input type="password" placeholder="••••••••" required={!editingId}
                  value={formData.password_confirmation} onChange={e => setFormData({ ...formData, password_confirmation: e.target.value })}
                  className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-medium" />
              </div>
              {/* Active Status */}
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Account Status</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${formData.is_active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                    <span className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${formData.is_active ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                  <span className={`text-sm font-bold ${formData.is_active ? "text-emerald-500" : "text-amber-500"}`}>
                    {formData.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              {/* Case Type Permissions (for investigators) */}
              {formData.role === "INVESTIGATOR" && (
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Allowed Case Types <span className="text-slate-400 normal-case">(empty = all types)</span></label>
                  <div className="flex flex-wrap gap-2">
                    {CASE_TYPES.map(type => (
                      <button key={type} type="button" onClick={() => toggleCaseType(type)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          formData.allowed_case_types.includes(type)
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : "bg-white dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10 hover:border-emerald-300"
                        }`}>
                        {formData.allowed_case_types.includes(type) ? "✓ " : ""}{type}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={submitLoading}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl text-sm disabled:opacity-50 transition-all">
                {submitLoading ? "Saving..." : editingId ? "Update User" : "Create User"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                className="flex-1 py-3 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm hover:bg-slate-200 dark:hover:bg-white/10 transition-all">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] overflow-hidden">
        {users.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-slate-500 font-medium">No staff users found. Create the first user to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                <tr>
                  {["#", "Name", "Email", "Role", "Status", "Case Types", "Member Since", "Actions"].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {users.map((user, idx) => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-white/3 transition-colors">
                    <td className="px-5 py-4 text-xs text-slate-500 font-bold">{idx + 1}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-sm uppercase flex-shrink-0">
                          {user.name.charAt(0)}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-400">{user.email}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${roleColor(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleToggleActive(user.id)}
                        disabled={togglingId === user.id}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border cursor-pointer hover:opacity-80 transition-all ${activeColor(user.is_active)}`}>
                        {togglingId === user.id ? "..." : user.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {user.role === "INVESTIGATOR" && user.allowed_case_types && user.allowed_case_types.length > 0
                          ? user.allowed_case_types.map(t => (
                            <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">{t}</span>
                          ))
                          : <span className="text-[10px] text-slate-400 italic">{user.role === "ADMIN" ? "All" : "All types"}</span>
                        }
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap text-xs">
                      {new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            setEditingId(user.id);
                            setFormData({ name: user.name, email: user.email, password: "", password_confirmation: "", role: user.role as any, is_active: user.is_active, allowed_case_types: user.allowed_case_types || [] });
                            setShowForm(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[10px] font-black uppercase tracking-wider hover:bg-blue-500/20 transition-all">
                          Edit
                        </button>
                        <button onClick={() => handleResetPassword(user.id, user.name)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-black uppercase tracking-wider hover:bg-amber-500/20 transition-all">
                          Reset PW
                        </button>
                        <button onClick={() => handleDelete(user.id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px] font-black uppercase tracking-wider hover:bg-rose-500/20 transition-all">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reset Password Result Modal */}
      {resetResult && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-amber-500 uppercase tracking-wider">Password Reset Successful</h3>
            <button onClick={() => setResetResult(null)} className="text-amber-500 hover:text-amber-400 text-lg font-bold">&times;</button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">Temporary password (share securely with the user):</p>
          <code className="block px-4 py-3 rounded-lg bg-slate-900 text-amber-400 font-mono text-sm tracking-widest select-all">{resetResult.tempPassword}</code>
          <p className="text-[10px] text-slate-400 mt-2">This password expires in 24 hours. The user must change it upon login.</p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "Total Staff", value: users.length },
          { label: "Investigators", value: users.filter(u => u.role === "INVESTIGATOR").length },
          { label: "Admins", value: users.filter(u => u.role === "ADMIN").length },
          { label: "Active", value: users.filter(u => u.is_active).length },
          { label: "Inactive", value: users.filter(u => !u.is_active).length },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080c18] p-4 text-center">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

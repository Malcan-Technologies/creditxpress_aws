"use client";

import { useState, useEffect } from "react";
import AdminLayout from "../../../components/AdminLayout";
import { fetchWithAdminTokenRefresh } from "../../../../lib/authUtils";
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

interface AccessLog {
  id: string;
  userId: string;
  userName: string;
  phoneNumber: string;
  userRole: string;
  ipAddress: string | null;
  userAgent: string | null;
  loginTimestamp: string;
  sessionDuration: number | null;
  logoutTimestamp: string | null;
  parsedUserAgent: {
    browser: string;
    os: string;
    device: string;
  };
}

export default function AdminAccessLogsPage() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [userRole, setUserRole] = useState("ALL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [page, year, userRole, search]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
      });

      if (year && year !== "all") {
        params.append("year", year);
      }
      if (userRole && userRole !== "ALL") {
        params.append("userRole", userRole);
      }
      if (search) {
        params.append("search", search);
      }

      const response = await fetchWithAdminTokenRefresh<any>(
        `/api/admin/access-logs?${params.toString()}`
      );

      if (response.success) {
        setLogs(response.data);
        setTotalPages(response.pagination.totalPages);
        setTotal(response.pagination.total);
      }
    } catch (error) {
      console.error("Error fetching access logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();

      if (year && year !== "all") {
        params.append("year", year);
      }
      if (userRole && userRole !== "ALL") {
        params.append("userRole", userRole);
      }
      if (search) {
        params.append("search", search);
      }

      const response = await fetch(
        `/api/admin/access-logs/export?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("adminToken") || ""}`,
          },
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `admin-access-logs-${new Date().toISOString()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error("Export failed");
      }
    } catch (error) {
      console.error("Error exporting logs:", error);
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-MY", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const currentYear = new Date().getFullYear();
  const years = ["all", currentYear.toString(), (currentYear - 1).toString(), (currentYear - 2).toString()];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Access Logs</h1>
            <p className="text-sm text-gray-400 mt-1">
              Track admin and attestor login activity for audit purposes
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            {exporting ? "Exporting..." : "Download CSV"}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <FunnelIcon className="h-5 w-5" />
              Filters
            </h3>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {showFilters ? "Hide" : "Show"}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Year Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Year
                </label>
                <select
                  value={year}
                  onChange={(e) => {
                    setYear(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y === "all" ? "All Time" : y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  User Role
                </label>
                <select
                  value={userRole}
                  onChange={(e) => {
                    setUserRole(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="ALL">All Roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="ATTESTOR">Attestor</option>
                </select>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search by name or phone number..."
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Search
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-400">
          Showing {logs.length} of {total} total access logs
        </div>

        {/* Table */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <p className="text-lg font-medium">No access logs found</p>
              <p className="text-sm mt-2">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Browser
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      OS
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Device
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                        {formatDate(log.loginTimestamp)}
                      </td>
                      <td className="px-4 py-3 text-sm text-white">
                        {log.userName || "Unknown"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {log.phoneNumber}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            log.userRole === "ADMIN"
                              ? "bg-purple-500/20 text-purple-300"
                              : "bg-blue-500/20 text-blue-300"
                          }`}
                        >
                          {log.userRole}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {log.ipAddress || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {log.parsedUserAgent.browser}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {log.parsedUserAgent.os}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {log.parsedUserAgent.device}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="flex items-center gap-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="h-5 w-5" />
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}


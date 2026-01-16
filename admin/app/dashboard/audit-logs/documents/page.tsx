"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AdminLayout from "../../../components/AdminLayout";
import { fetchWithAdminTokenRefresh } from "../../../../lib/authUtils";
import { toast } from "sonner";
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface DocumentLog {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  documentType: string;
  userId: string | null;
  userName: string | null;
  loanId: string | null;
  applicationId: string | null;
  uploadedAt: string;
  discoveredAt: string;
  isOrphaned: boolean;
  source: string;
  metadata: any;
}

interface ScanStats {
  totalScanned: number;
  matched: number;
  orphaned: number;
  vpsFiles: number;
  onpremFiles: number;
  errors: string[];
}

export default function DocumentStorageLogsPage() {
  const [logs, setLogs] = useState<DocumentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [scanStats, setScanStats] = useState<ScanStats | null>(null);
  
  // Filters
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [documentType, setDocumentType] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [isOrphaned, setIsOrphaned] = useState("false"); // Default to showing only matched documents
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [page, year, documentType, source, isOrphaned, search]);

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
      if (documentType && documentType !== "ALL") {
        params.append("documentType", documentType);
      }
      if (source && source !== "ALL") {
        params.append("source", source);
      }
      if (isOrphaned && isOrphaned !== "ALL") {
        params.append("isOrphaned", isOrphaned === "true" ? "true" : "false");
      }
      if (search) {
        params.append("search", search);
      }

      const response = await fetchWithAdminTokenRefresh<any>(
        `/api/admin/document-logs?${params.toString()}`
      );

      if (response.success) {
        setLogs(response.data);
        setTotalPages(response.pagination.totalPages);
        setTotal(response.pagination.total);
      }
    } catch (error) {
      console.error("Error fetching document logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleScan = async () => {
    try {
      setScanning(true);
      const response = await fetchWithAdminTokenRefresh<any>(
        `/api/admin/document-logs/scan`,
        {
          method: "POST",
        }
      );

      if (response.success) {
        setScanStats(response.stats);
        // Refresh the logs after scan
        await fetchLogs();
        toast.success(`Document scan completed: ${response.stats.totalScanned} files scanned, ${response.stats.matched} matched`);
      } else {
        toast.error("Document scan failed");
      }
    } catch (error) {
      console.error("Error scanning documents:", error);
      toast.error("Failed to scan documents");
    } finally {
      setScanning(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();

      if (year && year !== "all") {
        params.append("year", year);
      }
      if (documentType && documentType !== "ALL") {
        params.append("documentType", documentType);
      }
      if (source && source !== "ALL") {
        params.append("source", source);
      }
      if (isOrphaned && isOrphaned !== "ALL") {
        params.append("isOrphaned", isOrphaned === "true" ? "true" : "false");
      }
      if (search) {
        params.append("search", search);
      }

      const response = await fetch(
        `/api/admin/document-logs/export?${params.toString()}`,
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
        a.download = `document-logs-${new Date().toISOString()}.csv`;
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

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024).toFixed(2) + " KB";
  };

  const currentYear = new Date().getFullYear();
  const years = ["all", ...Array.from({ length: 8 }, (_, i) => (currentYear - i).toString())];

  const documentTypes = [
    "ALL",
    "KYC",
    "USER_DOCUMENT",
    "DISBURSEMENT_SLIP",
    "PAYMENT_RECEIPT",
    "STAMPED_AGREEMENT",
    "STAMP_CERTIFICATE",
    "SIGNED_AGREEMENT",
    "ORIGINAL_AGREEMENT",
    "DEFAULT_LETTER",
    "UNKNOWN",
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Document Storage Logs</h1>
            <p className="text-sm text-gray-400 mt-1">
              Track all documents stored in S3 cloud storage and on-premises servers
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-5 w-5 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? "Scanning..." : "Scan Documents"}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              {exporting ? "Exporting..." : "Download CSV"}
            </button>
          </div>
        </div>

        {/* Scan Stats */}
        {scanStats && (
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <h3 className="text-lg font-medium text-white mb-3">Last Scan Results</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{scanStats.totalScanned}</div>
                <div className="text-xs text-gray-400">Total Scanned</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{scanStats.matched}</div>
                <div className="text-xs text-gray-400">Matched</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{scanStats.orphaned}</div>
                <div className="text-xs text-gray-400">Orphaned</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{scanStats.vpsFiles}</div>
                <div className="text-xs text-gray-400">S3 Files</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-400">{scanStats.onpremFiles}</div>
                <div className="text-xs text-gray-400">On-Prem Files</div>
              </div>
            </div>
            {scanStats.errors.length > 0 && (
              <div className="mt-4 p-3 bg-red-900/20 border border-red-800/30 rounded-lg">
                <p className="text-sm text-red-400 font-medium mb-2">Errors during scan:</p>
                <ul className="text-xs text-red-400 list-disc list-inside">
                  {scanStats.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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

              {/* Document Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Document Type
                </label>
                <select
                  value={documentType}
                  onChange={(e) => {
                    setDocumentType(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  {documentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type === "ALL" ? "All Types" : type.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Source
                </label>
                <select
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="ALL">All Sources</option>
                  <option value="S3">S3 Cloud Storage</option>
                  <option value="ONPREM">On-Premises</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={isOrphaned}
                  onChange={(e) => {
                    setIsOrphaned(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="ALL">All Status</option>
                  <option value="false">Matched</option>
                  <option value="true">Orphaned</option>
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
                placeholder="Search by file name, user name, or user ID..."
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
          Showing {logs.length} of {total} total documents
        </div>

        {/* Table */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <p className="text-lg font-medium">No documents found</p>
              <p className="text-sm mt-2">
                {total === 0 ? "Run a scan to index documents" : "Try adjusting your filters"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      File Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Loan ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Upload Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-sm text-white">
                        <div className="max-w-xs truncate" title={log.fileName}>
                          {log.fileName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300">
                          {log.documentType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {log.userName || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">
                        {log.loanId ? (
                          <Link
                            href={`/dashboard/loans?loanId=${log.loanId}`}
                            className="text-blue-400 hover:text-blue-300 hover:underline"
                            title={`View loan ${log.loanId}`}
                          >
                            {log.loanId.substring(0, 8)}...
                          </Link>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                        {formatDate(log.uploadedAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {formatFileSize(log.fileSize)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            log.source === "S3"
                              ? "bg-purple-500/20 text-purple-300"
                              : log.source === "ONPREM"
                              ? "bg-cyan-500/20 text-cyan-300"
                              : "bg-gray-500/20 text-gray-300"
                          }`}
                        >
                          {log.source === "S3" ? "S3" : log.source === "ONPREM" ? "On-Prem" : log.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {log.isOrphaned ? (
                          <span className="flex items-center gap-1 text-yellow-400">
                            <ExclamationTriangleIcon className="h-4 w-4" />
                            Orphaned
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-400">
                            <CheckCircleIcon className="h-4 w-4" />
                            Matched
                          </span>
                        )}
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


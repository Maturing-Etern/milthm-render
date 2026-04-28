#!/usr/bin/env python3
"""
MRP 资源包分析工具 v2 - 支持大端序
"""

import struct
import sys
from pathlib import Path

def read_uint64_be(data, pos):
    """读取大端序 64 位整数"""
    return struct.unpack('>Q', data[pos:pos+8])[0]

def read_uint32_be(data, pos):
    """读取大端序 32 位整数"""
    return struct.unpack('>I', data[pos:pos+4])[0]

def read_uint32_le(data, pos):
    """读取小端序 32 位整数"""
    return struct.unpack('<I', data[pos:pos+4])[0]

def analyze_mrp(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    
    print(f"文件大小: {len(data)} 字节")
    
    pos = 0
    # 魔数
    magic = data[pos:pos+4]
    pos += 4
    print(f"魔数: {magic} ({magic.decode('ascii') if magic.isascii() else '非ASCII'})")
    
    # 版本 - 尝试两种字节序
    version_le = read_uint32_le(data, pos)
    version_be = read_uint32_be(data, pos)
    print(f"版本 (小端序): {version_le} (0x{version_le:08x})")
    print(f"版本 (大端序): {version_be} (0x{version_be:08x})")
    
    # 根据魔数判断字节序
    # MRP0 可能是大端序，因为字符串长度字段看起来是大端序
    if magic == b'MRP0':
        print("假设为大端序格式")
        version = version_be
        pos += 4
        
        # 未知字段 (8字节)
        unknown = read_uint64_be(data, pos)
        pos += 8
        print(f"未知字段: 0x{unknown:016x}")
        
        # 读取字符串表
        strings = []
        while pos < len(data):
            # 读取字符串长度 (8字节大端序)
            if pos + 8 > len(data):
                break
            
            str_len = read_uint64_be(data, pos)
            pos += 8
            
            if str_len == 0:
                # 可能是字符串表结束
                print(f"字符串长度为零，字符串表结束")
                break
            
            if str_len > 1000000:  # 不合理的长字符串
                print(f"字符串长度异常 ({str_len})，可能不是字符串表")
                pos -= 8  # 回退
                break
            
            if pos + str_len > len(data):
                print(f"警告: 字符串长度超出文件范围")
                break
            
            string_data = data[pos:pos+str_len]
            pos += str_len
            
            # 尝试解码为 UTF-8
            try:
                string = string_data.decode('utf-8')
                strings.append(string)
                print(f"  字符串 [{len(strings)-1}] ({str_len} 字节): {repr(string[:80])}")
            except:
                # 可能是二进制数据
                print(f"  二进制数据 [{len(strings)}] ({str_len} 字节): 前16字节 {string_data[:16].hex()}")
                strings.append(string_data)  # 保存二进制数据
        
        print(f"\n共读取 {len(strings)} 个字符串/数据块")
        print(f"当前位置: 0x{pos:x} ({pos})")
        
        # 剩余数据应该是资源索引和资源数据
        remaining = len(data) - pos
        print(f"剩余数据: {remaining} 字节")
        
        # 尝试解析资源索引
        # 假设索引结构: 资源类型(4字节) + 偏移量(8字节) + 大小(8字节)
        index_entry_size = 4 + 8 + 8  # 20字节
        
        if remaining >= index_entry_size:
            # 先读取可能的资源数量 (4字节?)
            num_resources = read_uint32_be(data, pos)
            print(f"可能的资源数量 (大端序): {num_resources}")
            
            # 尝试解析前几个条目
            for i in range(min(20, remaining // index_entry_size)):
                entry_pos = pos + i * index_entry_size
                if entry_pos + index_entry_size > len(data):
                    break
                
                entry_type = read_uint32_be(data, entry_pos)
                entry_offset = read_uint64_be(data, entry_pos + 4)
                entry_size = read_uint64_be(data, entry_pos + 12)
                
                print(f"  条目 {i}: 类型=0x{entry_type:08x}, 偏移量=0x{entry_offset:x}, 大小={entry_size}")
                
                # 检查偏移量是否有效
                if entry_offset < len(data) and entry_size > 0 and entry_size < 1000000:
                    # 查看数据前几个字节
                    data_start = entry_offset
                    data_preview = data[data_start:data_start+16]
                    print(f"      数据预览: {data_preview.hex()}")
                    
                    # 检查是否是音频
                    if data_preview.startswith(b'RIFF') or data_preview.startswith(b'OggS') or data_preview[:2] == b'\xFF\xFB':
                        print(f"      ⭐ 可能是音频数据!")
        
        # 查找音频特征
        print(f"\n搜索音频特征...")
        audio_signatures = [
            (b'RIFF', 'WAV'),
            (b'OggS', 'OGG'),
            (b'\xFF\xFB', 'MPEG'),
            (b'\x49\x44\x33', 'MP3 ID3'),
        ]
        
        for sig, name in audio_signatures:
            sig_pos = data.find(sig)
            while sig_pos != -1:
                print(f"  发现 {name} 在偏移量 0x{sig_pos:x}")
                # 查找下一个
                sig_pos = data.find(sig, sig_pos + 1)
        
        # 保存剩余数据
        output_path = Path(filepath).with_suffix('.data.bin')
        with open(output_path, 'wb') as f:
            f.write(data[pos:])
        print(f"\n数据部分已保存到: {output_path}")
        
    else:
        print("未知格式")
    
    return data

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(f"用法: {sys.argv[0]} <mrp文件>")
        sys.exit(1)
    
    analyze_mrp(sys.argv[1])
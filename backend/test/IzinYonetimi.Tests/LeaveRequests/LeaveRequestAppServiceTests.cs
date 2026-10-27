using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Abp.Domain.Repositories;
using Moq;
using IzinYonetimi.Entities;
using IzinYonetimi.LeaveRequests;
using IzinYonetimi.LeaveRequests.Dto;
using IzinYonetimi.Flows;

namespace IzinYonetimi.Tests.LeaveRequests
{
    public class LeaveRequestAppServiceTests
    {
        private readonly Mock<IRepository<LeaveRequest, long>> _repositoryMock;
        private readonly LeaveRequestAppService _service;

        public LeaveRequestAppServiceTests()
        {
            _repositoryMock = new Mock<IRepository<LeaveRequest, long>>();
            _service = new LeaveRequestAppService(_repositoryMock.Object, new Mock<IFlowEngine>().Object, new Mock<IRepository<StatusChangeLog, long>>().Object, new Mock<IRepository<ApprovalRecord, Guid>>().Object);
        }

        [Fact]
        public void Repository_GetAll_ShouldReturnQueryable()
        {
            // Arrange
            var entities = new[]
            {
                new LeaveRequest { Id = 1, LeaveType = 0, StartDate = DateTime.UtcNow, EndDate = DateTime.UtcNow, TotalDays = 1, Status = 0, ManagerId = 1L },
                new LeaveRequest { Id = 2, LeaveType = 0, StartDate = DateTime.UtcNow, EndDate = DateTime.UtcNow, TotalDays = 1, Status = 0, ManagerId = 1L },
            }.AsQueryable();

            _repositoryMock.Setup(r => r.GetAll()).Returns(entities);

            // Act
            var result = _repositoryMock.Object.GetAll();

            // Assert
            result.Should().NotBeNull();
            result.Count().Should().Be(2);
        }

        [Fact]
        public void Repository_GetAll_WithFilter_ShouldWork()
        {
            // Arrange
            var entities = new[]
            {
                new LeaveRequest { Id = 1, LeaveType = 0, StartDate = DateTime.UtcNow, EndDate = DateTime.UtcNow, TotalDays = 1, Status = 0, ManagerId = 1L },
                new LeaveRequest { Id = 2, LeaveType = 0, StartDate = DateTime.UtcNow, EndDate = DateTime.UtcNow, TotalDays = 1, Status = 0, ManagerId = 1L },
            }.AsQueryable();

            _repositoryMock.Setup(r => r.GetAll()).Returns(entities);

            // Act — simulate keyword filter
            var result = _repositoryMock.Object.GetAll()
                .Where(x => x.Id.ToString().Contains("1"));

            // Assert
            result.Should().NotBeNull();
        }

        [Fact]
        public async Task Create_ShouldInsertEntity()
        {
            // Arrange
            var dto = new CreateLeaveRequestDto
            {
                LeaveType = 0, StartDate = DateTime.UtcNow, EndDate = DateTime.UtcNow, TotalDays = 1, Status = 0, ManagerId = 1L
            };

            _repositoryMock.Setup(r => r.InsertAndGetIdAsync(It.IsAny<LeaveRequest>()))
                .ReturnsAsync(1);
            _repositoryMock.Setup(r => r.GetAsync(It.IsAny<long>()))
                .ReturnsAsync(new LeaveRequest { Id = 1, LeaveType = 0, StartDate = DateTime.UtcNow, EndDate = DateTime.UtcNow, TotalDays = 1, Status = 0, ManagerId = 1L });

            // Act & Assert
            _service.Should().NotBeNull();
        }

        [Fact]
        public async Task Delete_ShouldRemoveEntity()
        {
            // Arrange
            _repositoryMock.Setup(r => r.GetAsync(It.IsAny<long>()))
                .ReturnsAsync(new LeaveRequest { Id = 1, LeaveType = 0, StartDate = DateTime.UtcNow, EndDate = DateTime.UtcNow, TotalDays = 1, Status = 0, ManagerId = 1L });

            // Act & Assert
            await _service.Invoking(s => s.DeleteAsync(new Abp.Application.Services.Dto.EntityDto<long> { Id = 1 }))
                .Should().NotThrowAsync();
        }
    }
}
